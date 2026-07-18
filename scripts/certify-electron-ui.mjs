import { execFile, spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const releaseRoot = path.join(projectRoot, "release");
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const productName = packageJson.productName ?? packageJson.name ?? "Aureo";
const packageName = packageJson.name ?? "aureo";

const LAUNCH_TIMEOUT_MS = Number.parseInt(
	process.env.AUREO_CERTIFY_LAUNCH_TIMEOUT_MS ?? "45000",
	10,
);
const PAGE_READY_TIMEOUT_MS = Number.parseInt(
	process.env.AUREO_CERTIFY_PAGE_READY_TIMEOUT_MS ?? "30000",
	10,
);
const TAB_PRESSES = Math.min(
	40,
	Math.max(1, Number.parseInt(process.env.AUREO_CERTIFY_TAB_PRESSES ?? "40", 10) || 40),
);
const RAF_SAMPLE_FRAMES = 120;
const RAF_WARMUP_FRAMES = 30;
const RAF_SAMPLE_RUNS = 3;
const RAF_SPIKE_THRESHOLD_MS = 50;
const OUTER_HTML_LIMIT = 240;
const AX_ENRICH_LIMIT = 100;
const DEFAULT_ZIP =
	process.platform === "darwin" ? path.join(releaseRoot, `${productName}-arm64.zip`) : null;
const BUNDLED_EDITOR_FIXTURE_RELATIVE = path.join(
	"Contents",
	"Resources",
	"assets",
	"wallpapers",
	"wispysky.mp4",
);

const disclaimer =
	"Automated CDP evidence only. Not a screen-reader, hardware, or full manual UI/UX certification.";

function nowIsoSafe() {
	return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function fail(message) {
	throw new Error(`[certify-electron-ui] ${message}`);
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function relativePath(filePath) {
	return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}

async function getFreePort() {
	return await new Promise((resolve, reject) => {
		const server = createServer();
		server.unref();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Unable to allocate a free TCP port"));
				return;
			}
			const { port } = address;
			server.close((error) => {
				if (error) reject(error);
				else resolve(port);
			});
		});
	});
}

function findAppBundle(startDir) {
	const queue = [startDir];
	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) continue;
		let entries;
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const child = path.join(current, entry.name);
			if (entry.name.endsWith(".app")) {
				return child;
			}
			queue.push(child);
		}
	}
	return null;
}

function resolveExecutable(appBundleDir) {
	const candidates = [
		path.join(appBundleDir, "Contents", "MacOS", productName),
		path.join(appBundleDir, "Contents", "MacOS", packageName),
		path.join(appBundleDir, "Contents", "MacOS", "Aureo"),
	];
	return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function resolveBundledEditorFixture(appBundleDir) {
	const fixturePath = path.join(appBundleDir, BUNDLED_EDITOR_FIXTURE_RELATIVE);
	if (!existsSync(fixturePath) || !statSync(fixturePath).isFile()) {
		fail(
			`Bundled editor fixture missing at ${fixturePath} (expected ${BUNDLED_EDITOR_FIXTURE_RELATIVE})`,
		);
	}
	return fixturePath;
}

async function verifyCodesign(appBundleDir) {
	try {
		const { stdout, stderr } = await execFileAsync(
			"/usr/bin/codesign",
			["--verify", "--deep", "--strict", "--verbose=2", appBundleDir],
			{
				encoding: "utf8",
				timeout: 120000,
				maxBuffer: 4 * 1024 * 1024,
			},
		);
		const output = [stdout, stderr].filter(Boolean).join("\n").trim();
		return {
			ok: true,
			command: "codesign --verify --deep --strict --verbose=2",
			target: appBundleDir,
			output,
		};
	} catch (error) {
		const stdout = error?.stdout ? String(error.stdout) : "";
		const stderr = error?.stderr ? String(error.stderr) : "";
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			command: "codesign --verify --deep --strict --verbose=2",
			target: appBundleDir,
			output: [stdout, stderr, message].filter(Boolean).join("\n").trim(),
		};
	}
}

class CdpClient {
	constructor(wsUrl) {
		this.wsUrl = wsUrl;
		this.ws = null;
		this.nextId = 1;
		this.pending = new Map();
		this.eventHandlers = new Map();
		this.closed = false;
	}

	async connect() {
		this.ws = new WebSocket(this.wsUrl);
		await new Promise((resolve, reject) => {
			const onOpen = () => {
				cleanup();
				resolve();
			};
			const onError = (event) => {
				cleanup();
				reject(
					new Error(`WebSocket connection failed: ${event?.message ?? "unknown error"}`),
				);
			};
			const cleanup = () => {
				this.ws?.removeEventListener("open", onOpen);
				this.ws?.removeEventListener("error", onError);
			};
			this.ws.addEventListener("open", onOpen);
			this.ws.addEventListener("error", onError);
		});

		this.ws.addEventListener("message", (event) => {
			let message;
			try {
				message = JSON.parse(String(event.data));
			} catch {
				return;
			}

			if (typeof message.id === "number" && this.pending.has(message.id)) {
				const { resolve, reject } = this.pending.get(message.id);
				this.pending.delete(message.id);
				if (message.error) {
					reject(
						new Error(
							`CDP ${message.error.message ?? "error"}${
								message.error.code != null ? ` (${message.error.code})` : ""
							}`,
						),
					);
					return;
				}
				resolve(message.result);
				return;
			}

			if (message.method) {
				const handlers = this.eventHandlers.get(message.method) ?? [];
				for (const handler of handlers) {
					try {
						handler(message.params ?? {});
					} catch {
						// Ignore handler failures; certification continues.
					}
				}
			}
		});

		this.ws.addEventListener("close", () => {
			this.closed = true;
			for (const { reject } of this.pending.values()) {
				reject(new Error("CDP WebSocket closed"));
			}
			this.pending.clear();
		});
	}

	on(method, handler) {
		const handlers = this.eventHandlers.get(method) ?? [];
		handlers.push(handler);
		this.eventHandlers.set(method, handlers);
		return () => {
			const next = (this.eventHandlers.get(method) ?? []).filter(
				(entry) => entry !== handler,
			);
			this.eventHandlers.set(method, next);
		};
	}

	send(method, params = {}, sessionId) {
		if (!this.ws || this.closed) {
			return Promise.reject(new Error(`CDP not connected when calling ${method}`));
		}
		const id = this.nextId++;
		const payload = { id, method, params };
		if (sessionId) payload.sessionId = sessionId;
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			try {
				this.ws.send(JSON.stringify(payload));
			} catch (error) {
				this.pending.delete(id);
				reject(error);
			}
		});
	}

	async close() {
		if (!this.ws || this.closed) return;
		this.closed = true;
		try {
			this.ws.close();
		} catch {
			// ignore
		}
	}
}

async function waitForJson(url, timeoutMs, label) {
	const started = Date.now();
	let lastError = null;
	while (Date.now() - started < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) {
				return await response.json();
			}
			lastError = new Error(`${label} returned HTTP ${response.status}`);
		} catch (error) {
			lastError = error;
		}
		await sleep(250);
	}
	const detail = lastError instanceof Error ? lastError.message : String(lastError);
	fail(`${label} not ready within ${timeoutMs}ms: ${detail}`);
}

async function waitForUserDataIsolation(getOutput, expectedPath, timeoutMs) {
	const expectedRealPath = realpathSync(expectedPath);
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const match = getOutput().match(/^User Data Path:\s*(.+)$/m);
		if (match?.[1]) {
			const actualPath = match[1].trim();
			let actualRealPath;
			try {
				actualRealPath = realpathSync(actualPath);
			} catch {
				fail(`Reported userData path does not exist: ${actualPath}`);
			}
			if (actualRealPath !== expectedRealPath) {
				fail(
					`Packaged app escaped certification userData isolation: expected ${expectedRealPath}, got ${actualRealPath}`,
				);
			}
			return { expectedPath: expectedRealPath, reportedPath: actualRealPath };
		}
		await sleep(100);
	}
	fail(`Packaged app did not report its userData path within ${timeoutMs}ms`);
}

function summarizeTarget(target) {
	return {
		id: target?.id ?? null,
		type: target?.type ?? null,
		title: target?.title ?? null,
		url: target?.url ?? null,
		webSocketDebuggerUrl: target?.webSocketDebuggerUrl ?? null,
	};
}

function summarizeAllTargets(targets) {
	return (targets ?? []).map((target) => ({
		id: target.id,
		type: target.type,
		title: target.title,
		url: target.url,
		webSocketDebuggerUrl: target.webSocketDebuggerUrl ?? null,
	}));
}

function getUrlQueryParams(url) {
	try {
		return new URL(String(url ?? "")).searchParams;
	} catch {
		const queryIndex = String(url ?? "").indexOf("?");
		if (queryIndex < 0) return new URLSearchParams();
		return new URLSearchParams(String(url).slice(queryIndex + 1));
	}
}

function targetMatchesRequiredQuery(target, requiredQuery) {
	const params = getUrlQueryParams(target?.url);
	return Object.entries(requiredQuery).every(([key, value]) => params.get(key) === String(value));
}

function findExactPageTarget(targets, requiredQuery, surfaceId) {
	const pageLike = (targets ?? []).filter(
		(target) => target?.type === "page" || target?.type === "webview",
	);
	const matches = pageLike.filter((target) => targetMatchesRequiredQuery(target, requiredQuery));

	if (matches.length === 0) {
		return {
			target: null,
			error: `No exact page target for surface "${surfaceId}" with query ${JSON.stringify(
				requiredQuery,
			)}. Targets: ${JSON.stringify(summarizeAllTargets(targets))}`,
		};
	}
	if (matches.length > 1) {
		return {
			target: null,
			error: `Ambiguous page targets for surface "${surfaceId}" with query ${JSON.stringify(
				requiredQuery,
			)}. Matches: ${JSON.stringify(summarizeAllTargets(matches))}`,
		};
	}
	const [target] = matches;
	if (!target?.webSocketDebuggerUrl) {
		return {
			target: null,
			error: `Exact page target for surface "${surfaceId}" has no webSocketDebuggerUrl: ${JSON.stringify(
				summarizeTarget(target),
			)}`,
		};
	}
	return { target, error: null };
}

function axName(node) {
	const props = Array.isArray(node?.properties) ? node.properties : [];
	const nameProp = props.find((prop) => prop?.name === "name");
	if (nameProp && typeof nameProp.value === "string") return nameProp.value;
	if (nameProp && nameProp.value && typeof nameProp.value.value === "string") {
		return nameProp.value.value;
	}
	if (typeof node?.name?.value === "string") return node.name.value;
	if (typeof node?.name === "string") return node.name;
	return "";
}

function axRole(node) {
	if (typeof node?.role?.value === "string") return node.role.value;
	if (typeof node?.role === "string") return node.role;
	return "";
}

function isInteractiveAxRole(role) {
	return [
		"button",
		"link",
		"textbox",
		"searchbox",
		"combobox",
		"listbox",
		"option",
		"menuitem",
		"menuitemcheckbox",
		"menuitemradio",
		"checkbox",
		"radio",
		"switch",
		"slider",
		"spinbutton",
		"tab",
		"treeitem",
	].includes(String(role).toLowerCase());
}

function summarizeAxNodeProperties(node) {
	return (node.properties ?? []).slice(0, 12).map((prop) => ({
		name: prop?.name ?? null,
		value:
			typeof prop?.value === "object" && prop?.value
				? (prop.value.value ?? null)
				: (prop?.value ?? null),
	}));
}

function attributesArrayToObject(attributes) {
	const result = {};
	if (!Array.isArray(attributes)) return result;
	for (let index = 0; index + 1 < attributes.length; index += 2) {
		const name = attributes[index];
		const value = attributes[index + 1];
		if (typeof name === "string") {
			result[name] = value == null ? null : String(value);
		}
	}
	return result;
}

function pickDiagnosticAttributes(attributes) {
	const selected = {};
	for (const [name, value] of Object.entries(attributes ?? {})) {
		const lower = name.toLowerCase();
		if (
			lower === "aria-label" ||
			lower === "aria-labelledby" ||
			lower === "type" ||
			lower === "role" ||
			lower === "id" ||
			lower === "name" ||
			lower === "class" ||
			lower === "title" ||
			lower === "alt" ||
			lower === "placeholder" ||
			lower.startsWith("data-")
		) {
			selected[name] = value;
		}
	}
	return selected;
}

function compactOuterHtml(outerHTML) {
	if (typeof outerHTML !== "string" || !outerHTML) return null;
	return outerHTML.replace(/\s+/g, " ").trim().slice(0, OUTER_HTML_LIMIT);
}

function summarizeAncestorChain(ancestors) {
	if (!Array.isArray(ancestors) || ancestors.length === 0) return null;
	return ancestors
		.map((ancestor) => {
			const tag = ancestor?.tag || ancestor?.nodeName || "?";
			const id = ancestor?.id ? `#${ancestor.id}` : "";
			const role = ancestor?.role ? `[role=${ancestor.role}]` : "";
			const testId =
				ancestor?.dataTestId || ancestor?.["data-testid"] || ancestor?.["data-test-id"]
					? `[data-testid=${ancestor.dataTestId || ancestor["data-testid"] || ancestor["data-test-id"]}]`
					: "";
			const className =
				typeof ancestor?.className === "string" && ancestor.className
					? `.${ancestor.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`
					: "";
			return `${tag}${id}${role}${testId}${className}`;
		})
		.join(" > ");
}

async function enrichUnnamedInteractiveAxNode(client, sessionId, node, role) {
	const backendDOMNodeId =
		typeof node?.backendDOMNodeId === "number" ? node.backendDOMNodeId : null;
	const summary = {
		nodeId: node?.nodeId ?? null,
		backendDOMNodeId,
		role,
		ignored: Boolean(node?.ignored),
		properties: summarizeAxNodeProperties(node),
		dom: null,
		domEnrichmentError: null,
	};

	if (backendDOMNodeId == null) {
		return summary;
	}

	try {
		await client.send("DOM.enable", {}, sessionId).catch(() => {
			// DOM may already be enabled; continue best-effort enrichment.
		});

		let nodeName = null;
		let attributes = {};
		let outerHTML = null;
		let ancestors = [];

		try {
			const described = await client.send(
				"DOM.describeNode",
				{
					backendNodeId: backendDOMNodeId,
					depth: 0,
				},
				sessionId,
			);
			const describedNode = described?.node ?? null;
			if (describedNode) {
				nodeName = describedNode.nodeName ?? null;
				attributes = attributesArrayToObject(describedNode.attributes);
			}
		} catch {
			// Fall through to resolveNode enrichment.
		}

		try {
			const htmlResult = await client.send(
				"DOM.getOuterHTML",
				{
					backendNodeId: backendDOMNodeId,
				},
				sessionId,
			);
			outerHTML = compactOuterHtml(htmlResult?.outerHTML);
		} catch {
			// Outer HTML is best-effort.
		}

		try {
			const resolved = await client.send(
				"DOM.resolveNode",
				{
					backendNodeId: backendDOMNodeId,
				},
				sessionId,
			);
			const objectId = resolved?.object?.objectId;
			if (objectId) {
				const runtimeResult = await client.send(
					"Runtime.callFunctionOn",
					{
						objectId,
						returnByValue: true,
						functionDeclaration: `function() {
							const el = this;
							if (!(el instanceof Element)) {
								return {
									nodeName: el && el.nodeName ? el.nodeName : null,
									tag: null,
									attributes: {},
									outerHTML: null,
									ancestors: []
								};
							}
							const attrs = {};
							for (const attr of Array.from(el.attributes || [])) {
								const name = attr && attr.name ? String(attr.name) : "";
								if (!name) continue;
								const lower = name.toLowerCase();
								if (
									lower === "aria-label" ||
									lower === "aria-labelledby" ||
									lower === "type" ||
									lower === "role" ||
									lower === "id" ||
									lower === "name" ||
									lower === "class" ||
									lower === "title" ||
									lower === "alt" ||
									lower === "placeholder" ||
									lower.indexOf("data-") === 0
								) {
									attrs[name] = attr.value == null ? null : String(attr.value);
								}
							}
							const ancestors = [];
							let current = el.parentElement;
							let depth = 0;
							while (current && depth < 6) {
								ancestors.push({
									tag: current.tagName ? current.tagName.toLowerCase() : null,
									nodeName: current.nodeName || null,
									id: current.id || null,
									role: current.getAttribute("role"),
									className:
										typeof current.className === "string"
											? current.className.slice(0, 80)
											: null,
									dataTestId:
										current.getAttribute("data-testid") ||
										current.getAttribute("data-test-id") ||
										null
								});
								current = current.parentElement;
								depth += 1;
							}
							return {
								nodeName: el.nodeName || null,
								tag: el.tagName ? el.tagName.toLowerCase() : null,
								attributes: attrs,
								outerHTML: el.outerHTML ? el.outerHTML.slice(0, ${OUTER_HTML_LIMIT}) : null,
								ancestors: ancestors
							};
						}`,
					},
					sessionId,
				);
				if (runtimeResult?.exceptionDetails) {
					throw new Error(formatExceptionDetails(runtimeResult.exceptionDetails));
				}
				const value = runtimeResult?.result?.value ?? null;
				if (value && typeof value === "object") {
					nodeName = value.nodeName ?? nodeName;
					if (value.attributes && typeof value.attributes === "object") {
						attributes = { ...attributes, ...value.attributes };
					}
					if (!outerHTML) {
						outerHTML = compactOuterHtml(value.outerHTML);
					}
					if (Array.isArray(value.ancestors)) {
						ancestors = value.ancestors;
					}
				}
				try {
					await client.send("Runtime.releaseObject", { objectId }, sessionId);
				} catch {
					// ignore release failures
				}
			}
		} catch (error) {
			// Keep describeNode/getOuterHTML data when Runtime enrichment fails.
			if (!summary.dom && !nodeName && Object.keys(attributes).length === 0 && !outerHTML) {
				throw error;
			}
		}

		const diagnosticAttributes = pickDiagnosticAttributes(attributes);
		const tag =
			typeof nodeName === "string" && nodeName
				? nodeName.toLowerCase()
				: (diagnosticAttributes.role ?? null);

		summary.dom = {
			nodeName,
			tag,
			attributes: diagnosticAttributes,
			outerHTML,
			ancestorSummary: summarizeAncestorChain(ancestors),
			ancestors: ancestors.slice(0, 6),
		};
	} catch (error) {
		summary.domEnrichmentError = error instanceof Error ? error.message : String(error);
	}

	return summary;
}

function summarizeMetrics(metrics) {
	const map = {};
	for (const metric of metrics ?? []) {
		if (metric?.name != null) map[metric.name] = metric.value;
	}
	return map;
}

function formatExceptionDetails(exceptionDetails) {
	if (!exceptionDetails) return "Runtime.evaluate failed";
	const parts = [
		exceptionDetails.text,
		exceptionDetails.exception?.description,
		exceptionDetails.exception?.value != null ? String(exceptionDetails.exception.value) : null,
		exceptionDetails.lineNumber != null
			? `line ${exceptionDetails.lineNumber}:${exceptionDetails.columnNumber ?? 0}`
			: null,
	].filter(Boolean);
	return parts.join(" | ") || "Runtime.evaluate failed";
}

async function evaluate(client, sessionId, expression, awaitPromise = true) {
	const result = await client.send(
		"Runtime.evaluate",
		{
			expression,
			returnByValue: true,
			awaitPromise,
			userGesture: true,
		},
		sessionId,
	);
	if (result?.exceptionDetails) {
		throw new Error(formatExceptionDetails(result.exceptionDetails));
	}
	return result?.result?.value;
}

async function waitForDocumentReady(client, sessionId, timeoutMs, readiness = null) {
	const started = Date.now();
	let last = null;
	while (Date.now() - started < timeoutMs) {
		last = await evaluate(
			client,
			sessionId,
			`(() => {
				const interactiveSelector = [
					"a[href]",
					"button",
					"input",
					"select",
					"textarea",
					"[role='button']",
					"[tabindex]:not([tabindex='-1'])"
				].join(",");
				const interactiveCount = document.querySelectorAll(interactiveSelector).length;
				const editorHeader = document.querySelector('[data-editor-header-slot="leading"]');
				const editorShell = document.querySelector(".bg-editor-bg");
				const bodyText = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();
				const errorTextNode = document.querySelector(".text-destructive");
				const loadingTextPresent = /Loading video\\.{0,3}$/i.test(bodyText);
				const errorText =
					errorTextNode && errorTextNode instanceof HTMLElement
						? (errorTextNode.innerText || errorTextNode.textContent || "").trim()
						: "";
				return {
					readyState: document.readyState,
					title: document.title || "",
					visibilityState: document.visibilityState,
					href: location.href,
					bodyChildCount: document.body ? document.body.childElementCount : 0,
					interactiveCount,
					hasEditorHeader: Boolean(editorHeader),
					hasEditorShell: Boolean(editorShell),
					loadingTextPresent,
					errorText: errorText || null
				};
			})()`,
		);

		if (
			last &&
			(last.readyState === "interactive" || last.readyState === "complete") &&
			last.bodyChildCount > 0
		) {
			if (readiness?.mode === "editor-shell") {
				if (last.errorText) {
					fail(
						`Editor surface reached an error state before shell readiness: ${JSON.stringify(
							last,
						)}`,
					);
				}
				if (last.hasEditorHeader && last.hasEditorShell && !last.loadingTextPresent) {
					await sleep(500);
					return last;
				}
			} else if (last.interactiveCount > 0) {
				// Allow React/layout to settle after first interactive paint.
				await sleep(500);
				return last;
			}
		}
		await sleep(250);
	}

	if (readiness?.mode === "editor-shell") {
		fail(`Editor shell did not become ready within ${timeoutMs}ms: ${JSON.stringify(last)}`);
	}

	// Fall back to document readiness even if no interactive controls appear.
	if (
		last &&
		(last.readyState === "interactive" || last.readyState === "complete") &&
		last.bodyChildCount > 0
	) {
		return last;
	}
	fail(
		`Primary renderer page did not become ready within ${timeoutMs}ms: ${JSON.stringify(last)}`,
	);
}

async function collectDomAudit(client, sessionId) {
	return await evaluate(
		client,
		sessionId,
		`(() => {
			const interactiveSelector = [
				"a[href]",
				"button",
				"input",
				"select",
				"textarea",
				"summary",
				"[role='button']",
				"[role='link']",
				"[role='textbox']",
				"[role='checkbox']",
				"[role='radio']",
				"[role='switch']",
				"[role='menuitem']",
				"[role='tab']",
				"[role='option']",
				"[role='combobox']",
				"[tabindex]:not([tabindex='-1'])",
				"[contenteditable='']",
				"[contenteditable='true']"
			].join(",");

			const isVisible = (el) => {
				if (!(el instanceof Element)) return false;
				const style = window.getComputedStyle(el);
				if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
					return false;
				}
				const rect = el.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			};

			const usableName = (el) => {
				const ariaLabel = (el.getAttribute("aria-label") || "").trim();
				if (ariaLabel) return ariaLabel;
				const labelledBy = (el.getAttribute("aria-labelledby") || "").trim();
				if (labelledBy) {
					const text = labelledBy
						.split(/\\s+/)
						.map((id) => document.getElementById(id))
						.filter(Boolean)
						.map((node) => (node.textContent || "").trim())
						.filter(Boolean)
						.join(" ")
						.trim();
					if (text) return text;
				}
				const title = (el.getAttribute("title") || "").trim();
				if (title) return title;
				const alt = (el.getAttribute("alt") || "").trim();
				if (alt) return alt;
				if ("value" in el && typeof el.value === "string" && el.value.trim()) {
					return el.value.trim();
				}
				const text = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
				if (text) return text;
				return "";
			};

			const all = Array.from(document.querySelectorAll("*"));
			const interactive = Array.from(document.querySelectorAll(interactiveSelector));
			const idCounts = new Map();
			for (const el of all) {
				if (!el.id) continue;
				idCounts.set(el.id, (idCounts.get(el.id) || 0) + 1);
			}
			const duplicateIds = [...idCounts.entries()]
				.filter(([, count]) => count > 1)
				.map(([id, count]) => ({ id, count }))
				.sort((a, b) => a.id.localeCompare(b.id));

			const missingName = [];
			for (const el of interactive) {
				if (!isVisible(el)) continue;
				if (usableName(el)) continue;
				missingName.push({
					tag: el.tagName.toLowerCase(),
					id: el.id || null,
					role: el.getAttribute("role"),
					type: el.getAttribute("type"),
					className: typeof el.className === "string" ? el.className.slice(0, 160) : null,
					outerHTML: el.outerHTML.slice(0, 240)
				});
			}

			return {
				title: document.title || "",
				readyState: document.readyState,
				visibilityState: document.visibilityState,
				href: location.href,
				viewport: {
					innerWidth: window.innerWidth,
					innerHeight: window.innerHeight,
					devicePixelRatio: window.devicePixelRatio,
					scrollWidth: document.documentElement?.scrollWidth ?? null,
					scrollHeight: document.documentElement?.scrollHeight ?? null
				},
				interactiveElementCount: interactive.length,
				visibleInteractiveElementCount: interactive.filter(isVisible).length,
				duplicateIds,
				visibleInteractiveMissingAccessibleName: missingName.slice(0, 100),
				visibleInteractiveMissingAccessibleNameCount: missingName.length
			};
		})()`,
	);
}

async function collectAccessibility(client, sessionId) {
	await client.send("Accessibility.enable", {}, sessionId);
	const tree = await client.send("Accessibility.getFullAXTree", {}, sessionId);
	const nodes = Array.isArray(tree?.nodes) ? tree.nodes : [];
	const roleCounts = {};
	const interactiveEmptyNodes = [];
	for (const node of nodes) {
		const role = axRole(node) || "unknown";
		roleCounts[role] = (roleCounts[role] || 0) + 1;
		if (!isInteractiveAxRole(role)) continue;
		const name = axName(node).trim();
		if (!name) {
			interactiveEmptyNodes.push({ node, role });
		}
	}

	const interactiveEmptyNames = [];
	const enrichmentErrors = [];
	for (const entry of interactiveEmptyNodes.slice(0, AX_ENRICH_LIMIT)) {
		try {
			interactiveEmptyNames.push(
				await enrichUnnamedInteractiveAxNode(client, sessionId, entry.node, entry.role),
			);
		} catch (error) {
			// Failures to enrich one node must not abort the audit.
			const message = error instanceof Error ? error.message : String(error);
			enrichmentErrors.push(message);
			interactiveEmptyNames.push({
				nodeId: entry.node?.nodeId ?? null,
				backendDOMNodeId:
					typeof entry.node?.backendDOMNodeId === "number"
						? entry.node.backendDOMNodeId
						: null,
				role: entry.role,
				ignored: Boolean(entry.node?.ignored),
				properties: summarizeAxNodeProperties(entry.node),
				dom: null,
				domEnrichmentError: message,
			});
		}
	}

	return {
		nodeCount: nodes.length,
		roleCounts,
		interactiveNodesWithEmptyNameCount: interactiveEmptyNodes.length,
		interactiveNodesWithEmptyName: interactiveEmptyNames,
		interactiveNodesWithEmptyNameEnrichmentErrorCount: enrichmentErrors.length,
	};
}

async function collectTabTraversal(client, sessionId, presses) {
	const steps = [];
	// Focus the document body first so Tab traversal is deterministic.
	await evaluate(
		client,
		sessionId,
		`(() => {
			const body = document.body;
			if (body && !body.hasAttribute("tabindex")) body.setAttribute("tabindex", "-1");
			body?.focus?.();
			return true;
		})()`,
	);

	for (let index = 0; index < presses; index += 1) {
		await client.send(
			"Input.dispatchKeyEvent",
			{
				type: "keyDown",
				key: "Tab",
				code: "Tab",
				windowsVirtualKeyCode: 9,
				nativeVirtualKeyCode: 9,
			},
			sessionId,
		);
		await client.send(
			"Input.dispatchKeyEvent",
			{
				type: "keyUp",
				key: "Tab",
				code: "Tab",
				windowsVirtualKeyCode: 9,
				nativeVirtualKeyCode: 9,
			},
			sessionId,
		);

		const focused = await evaluate(
			client,
			sessionId,
			`(() => {
				const el = document.activeElement;
				if (!el) return null;
				const text = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
				return {
					tag: el.tagName ? el.tagName.toLowerCase() : null,
					id: el.id || null,
					role: el.getAttribute?.("role") || null,
					type: el.getAttribute?.("type") || null,
					name:
						(el.getAttribute?.("aria-label") || "").trim() ||
						(el.getAttribute?.("title") || "").trim() ||
						(typeof el.value === "string" ? el.value.trim() : "") ||
						text.slice(0, 120) ||
						null,
					className: typeof el.className === "string" ? el.className.slice(0, 160) : null,
					tabIndex: el.tabIndex ?? null
				};
			})()`,
		);

		steps.push({
			index: index + 1,
			focused,
		});
		await sleep(30);
	}

	const uniqueFocusKeys = new Set(
		steps
			.map((step) => {
				const focused = step.focused;
				if (!focused) return "null";
				return [focused.tag, focused.id, focused.role, focused.name, focused.className]
					.map((part) => part ?? "")
					.join("|");
			})
			.filter(Boolean),
	);

	return {
		presses,
		uniqueFocusedElementCount: uniqueFocusKeys.size,
		steps,
	};
}

async function captureScreenshot(client, sessionId, filePath) {
	const result = await client.send(
		"Page.captureScreenshot",
		{
			format: "png",
			fromSurface: true,
			captureBeyondViewport: false,
		},
		sessionId,
	);
	if (!result?.data) {
		fail(`Page.captureScreenshot returned no data for ${path.basename(filePath)}`);
	}
	writeFileSync(filePath, Buffer.from(result.data, "base64"));
	return {
		file: path.basename(filePath),
		bytes: Buffer.byteLength(result.data, "base64"),
	};
}

async function restoreDefaultMedia(client, sessionId) {
	await client.send(
		"Emulation.setEmulatedMedia",
		{
			media: "screen",
			features: [
				{ name: "prefers-color-scheme", value: "light" },
				{ name: "prefers-reduced-motion", value: "no-preference" },
				{ name: "prefers-reduced-transparency", value: "no-preference" },
				{ name: "prefers-contrast", value: "no-preference" },
				{ name: "forced-colors", value: "none" },
			],
		},
		sessionId,
	);
}

async function collectScreenshots(client, sessionId, outputDir, surfaceId) {
	const modes = [
		{
			id: "default",
			features: [],
		},
		{
			id: "dark",
			features: [{ name: "prefers-color-scheme", value: "dark" }],
		},
		{
			id: "reduced-motion",
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		},
		{
			id: "reduced-transparency",
			features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
		},
		{
			id: "increased-contrast",
			features: [{ name: "prefers-contrast", value: "more" }],
		},
		{
			id: "forced-colors",
			features: [{ name: "forced-colors", value: "active" }],
		},
	];

	const captures = [];
	for (const mode of modes) {
		await restoreDefaultMedia(client, sessionId);
		if (mode.features.length > 0) {
			await client.send(
				"Emulation.setEmulatedMedia",
				{
					features: mode.features,
				},
				sessionId,
			);
		}
		await sleep(200);
		const fileName = `screenshot-${surfaceId}-${mode.id}.png`;
		const filePath = path.join(outputDir, fileName);
		const capture = await captureScreenshot(client, sessionId, filePath);
		captures.push({
			mode: mode.id,
			features: mode.features,
			...capture,
		});
	}
	await restoreDefaultMedia(client, sessionId);
	return captures;
}

function summarizeRafIntervals(timestamps, requestedFrames) {
	const intervals = [];
	for (let index = 1; index < timestamps.length; index += 1) {
		intervals.push(timestamps[index] - timestamps[index - 1]);
	}
	const totalDuration =
		timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
	const averageInterval =
		intervals.length > 0
			? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
			: null;
	const sorted = intervals.slice().sort((a, b) => a - b);
	const p95Index =
		sorted.length === 0
			? null
			: Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1));
	return {
		requestedFrames,
		capturedFrames: timestamps.length,
		intervalCount: intervals.length,
		totalDurationMs: totalDuration,
		averageFrameIntervalMs: averageInterval,
		p95FrameIntervalMs: p95Index == null ? null : sorted[p95Index],
		maxFrameIntervalMs: sorted.length ? sorted[sorted.length - 1] : null,
		minFrameIntervalMs: sorted.length ? sorted[0] : null,
		intervals,
	};
}

function stripRafIntervals(sample) {
	if (!sample || typeof sample !== "object") return sample;
	const { intervals: _intervals, ...rest } = sample;
	return rest;
}

function percentileSorted(sortedValues, percentile) {
	if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
	const index = Math.min(
		sortedValues.length - 1,
		Math.max(0, Math.ceil(percentile * sortedValues.length) - 1),
	);
	return sortedValues[index];
}

function aggregateRafSamples(samples, spikeThresholdMs = RAF_SPIKE_THRESHOLD_MS) {
	const allIntervals = [];
	for (const sample of samples) {
		if (Array.isArray(sample?.intervals)) {
			allIntervals.push(...sample.intervals);
		}
	}
	const sorted = allIntervals.slice().sort((a, b) => a - b);
	const samplesWithMaxSpikeGteThreshold = samples.filter(
		(sample) => (sample?.maxFrameIntervalMs ?? 0) >= spikeThresholdMs,
	).length;
	const totalDurationMs = samples.reduce(
		(sum, sample) => sum + (sample?.totalDurationMs ?? 0),
		0,
	);
	const averageFrameIntervalMs =
		allIntervals.length > 0
			? allIntervals.reduce((sum, value) => sum + value, 0) / allIntervals.length
			: null;

	return {
		sampleCount: samples.length,
		requestedFramesPerSample: RAF_SAMPLE_FRAMES,
		intervalCount: allIntervals.length,
		totalDurationMs,
		averageFrameIntervalMs,
		p95FrameIntervalMs: percentileSorted(sorted, 0.95),
		maxFrameIntervalMs: sorted.length ? sorted[sorted.length - 1] : null,
		minFrameIntervalMs: sorted.length ? sorted[0] : null,
		spikeThresholdMs,
		samplesWithMaxSpikeGteThresholdMs: samplesWithMaxSpikeGteThreshold,
		repeatedMaxSpikeGteThresholdMs: samplesWithMaxSpikeGteThreshold >= 2,
	};
}

async function sampleRafIntervals(client, sessionId, frames) {
	// Return a Promise (no top-level await) so Runtime.evaluate + awaitPromise works broadly.
	const timestamps = await evaluate(
		client,
		sessionId,
		`(function() {
			const frames = ${frames};
			return new Promise(function(resolve, reject) {
				const timestamps = [];
				const tick = function(ts) {
					timestamps.push(ts);
					if (timestamps.length >= frames) {
						resolve(timestamps);
						return;
					}
					requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			});
		})()`,
		true,
	);
	if (!Array.isArray(timestamps) || timestamps.length === 0) {
		fail(`rAF sampling returned no timestamps for ${frames} requested frame(s)`);
	}
	return summarizeRafIntervals(timestamps, frames);
}

async function collectPerformance(client, sessionId) {
	await client.send("Performance.enable", {}, sessionId);
	const metricsResult = await client.send("Performance.getMetrics", {}, sessionId);
	const metrics = summarizeMetrics(metricsResult?.metrics);

	// Short warm-up sample discarded from spike classification, retained as evidence.
	const rafWarmupRaw = await sampleRafIntervals(client, sessionId, RAF_WARMUP_FRAMES);
	const rafWarmup = stripRafIntervals(rafWarmupRaw);

	const rafSampleRaws = [];
	for (let run = 0; run < RAF_SAMPLE_RUNS; run += 1) {
		rafSampleRaws.push(await sampleRafIntervals(client, sessionId, RAF_SAMPLE_FRAMES));
	}
	const rafSamples = rafSampleRaws.map((sample, index) => ({
		index: index + 1,
		...stripRafIntervals(sample),
	}));
	const rafAggregate = aggregateRafSamples(rafSampleRaws, RAF_SPIKE_THRESHOLD_MS);

	// Keep rafSample for compatibility: expose aggregate stats under the previous field.
	const rafSample = {
		requestedFrames: RAF_SAMPLE_FRAMES,
		capturedFrames: rafSampleRaws.reduce(
			(sum, sample) => sum + (sample.capturedFrames ?? 0),
			0,
		),
		sampleCount: rafSamples.length,
		totalDurationMs: rafAggregate.totalDurationMs,
		averageFrameIntervalMs: rafAggregate.averageFrameIntervalMs,
		p95FrameIntervalMs: rafAggregate.p95FrameIntervalMs,
		maxFrameIntervalMs: rafAggregate.maxFrameIntervalMs,
		minFrameIntervalMs: rafAggregate.minFrameIntervalMs,
		spikeThresholdMs: rafAggregate.spikeThresholdMs,
		samplesWithMaxSpikeGteThresholdMs: rafAggregate.samplesWithMaxSpikeGteThresholdMs,
		repeatedMaxSpikeGteThresholdMs: rafAggregate.repeatedMaxSpikeGteThresholdMs,
	};

	return {
		metrics,
		rafWarmup,
		rafSamples,
		rafAggregate,
		rafSample,
	};
}

function terminateProcessTree(child) {
	if (!child?.pid) return;
	try {
		process.kill(-child.pid, "SIGTERM");
	} catch {
		try {
			child.kill("SIGTERM");
		} catch {
			// ignore
		}
	}
}

async function forceKill(child) {
	if (!child?.pid) return;
	try {
		process.kill(-child.pid, "SIGKILL");
	} catch {
		try {
			child.kill("SIGKILL");
		} catch {
			// ignore
		}
	}
}

function createEmptySurfaceReport(surfaceId) {
	return {
		id: surfaceId,
		status: "pending",
		startedAt: null,
		finishedAt: null,
		launch: null,
		target: null,
		domAudit: null,
		accessibility: null,
		keyboardTraversal: null,
		screenshots: null,
		performance: null,
		findings: [],
		errors: [],
		launchLogs: [],
	};
}

function createSurfaceSpecs(appBundleDir) {
	const editorFixturePath = resolveBundledEditorFixture(appBundleDir);
	return [
		{
			id: "launch",
			requiredQuery: {
				windowType: "hud-overlay",
				certification: "1",
			},
			readiness: { mode: "interactive" },
			extraEnv: {},
			devOpenRecordingInput: null,
		},
		{
			id: "editor",
			requiredQuery: {
				windowType: "editor",
				certification: "1",
			},
			readiness: { mode: "editor-shell" },
			extraEnv: {
				AUREO_DEV_OPEN_RECORDING_INPUT: editorFixturePath,
			},
			devOpenRecordingInput: editorFixturePath,
		},
	];
}

async function requestBrowserClose(client, log) {
	if (!client || client.closed) return false;
	try {
		log("Sending Browser.close via CDP");
		await Promise.race([
			client.send("Browser.close"),
			sleep(1000).then(() => {
				throw new Error("Browser.close timed out after 1000ms");
			}),
		]);
		log("Browser.close acknowledged");
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (/CDP WebSocket closed/i.test(message)) {
			log("Browser.close closed the CDP WebSocket");
			return true;
		}
		log(`Browser.close best-effort failed: ${message}`);
		return false;
	}
}

async function terminateChildProcess(child, log) {
	if (!child || child.killed || child.exitCode != null) return;
	log("Terminating packaged app");
	terminateProcessTree(child);
	const waitStarted = Date.now();
	while (child.exitCode == null && Date.now() - waitStarted < 5000) {
		await sleep(100);
	}
	if (child.exitCode == null) {
		log("Force-killing packaged app");
		await forceKill(child);
		await sleep(200);
	}
}

function deleteTempDir(dir, log) {
	if (!dir) return;
	// Never touch real user data paths; only remove harness-created temp dirs.
	const tempRoot = realpathSync(tmpdir());
	let realDir;
	try {
		realDir = realpathSync(dir);
	} catch {
		return;
	}
	if (!realDir.startsWith(`${tempRoot}${path.sep}`)) {
		log(`Refusing to delete non-temp directory ${dir}`);
		return;
	}
	try {
		rmSync(realDir, { recursive: true, force: true });
		log(`Deleted temp directory ${realDir}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		log(`Failed to delete temp directory ${realDir}: ${message}`);
	}
}

async function certifySurface({
	surfaceSpec,
	appBundleDir,
	executablePath,
	reportDir,
	extractDir,
	parentLog,
}) {
	const surface = createEmptySurfaceReport(surfaceSpec.id);
	surface.startedAt = new Date().toISOString();
	const launchLogs = [];
	const log = (line) => {
		const entry = `[${new Date().toISOString()}] [${surfaceSpec.id}] ${line}`;
		launchLogs.push(entry);
		parentLog(entry);
	};

	let homeDir = null;
	let child = null;
	let client = null;

	try {
		homeDir = mkdtempSync(path.join(tmpdir(), `aureo-ui-cert-home-${surfaceSpec.id}-`));
		const debuggingPort = await getFreePort();
		const userDataDir = path.join(
			homeDir,
			"Library",
			"Application Support",
			`${productName}-cert`,
		);
		mkdirSync(userDataDir, { recursive: true });

		// Fresh HOME plus an explicit app-level certification profile. appPaths.ts
		// fails closed if certification mode is enabled without this absolute path.
		mkdirSync(path.join(homeDir, "Library", "Application Support"), { recursive: true });
		mkdirSync(path.join(homeDir, "Library", "Preferences"), { recursive: true });
		mkdirSync(path.join(homeDir, "Library", "Caches"), { recursive: true });
		mkdirSync(path.join(homeDir, "Library", "Logs"), { recursive: true });
		mkdirSync(path.join(homeDir, "tmp"), { recursive: true });

		const spawnArgs = [
			`--remote-debugging-port=${debuggingPort}`,
			"--remote-allow-origins=*",
			`--user-data-dir=${userDataDir}`,
			"--no-first-run",
			"--disable-background-networking",
			"--disable-default-apps",
			"--disable-sync",
			"--disable-component-update",
			"--disable-features=Translate,MediaRouter",
		];

		const env = {
			...process.env,
			HOME: homeDir,
			USERPROFILE: homeDir,
			TMPDIR: path.join(homeDir, "tmp"),
			XDG_CONFIG_HOME: path.join(homeDir, "Library", "Application Support"),
			XDG_CACHE_HOME: path.join(homeDir, "Library", "Caches"),
			AUREO_CERTIFICATION_MODE: "1",
			AUREO_CERTIFICATION_USER_DATA_DIR: userDataDir,
			ELECTRON_ENABLE_LOGGING: "1",
			...surfaceSpec.extraEnv,
		};
		// Ensure editor-only env is absent from launch surface isolation.
		if (!surfaceSpec.extraEnv.AUREO_DEV_OPEN_RECORDING_INPUT) {
			delete env.AUREO_DEV_OPEN_RECORDING_INPUT;
		}
		if (!surfaceSpec.extraEnv.AUREO_DEV_OPEN_RECORDING_WEBCAM) {
			delete env.AUREO_DEV_OPEN_RECORDING_WEBCAM;
		}

		log(
			`Launching ${executablePath} on port ${debuggingPort} with isolated HOME=${homeDir}${
				surfaceSpec.devOpenRecordingInput
					? ` and AUREO_DEV_OPEN_RECORDING_INPUT=${surfaceSpec.devOpenRecordingInput}`
					: ""
			}`,
		);
		child = spawn(executablePath, spawnArgs, {
			cwd: extractDir,
			env,
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
			shell: false,
			windowsHide: true,
		});

		const stdoutChunks = [];
		const stderrChunks = [];
		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", (chunk) => {
			stdoutChunks.push(chunk);
			for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
				log(`[app:stdout] ${line}`);
			}
		});
		child.stderr?.on("data", (chunk) => {
			stderrChunks.push(chunk);
			for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
				log(`[app:stderr] ${line}`);
			}
		});

		let childExit = null;
		child.on("exit", (code, signal) => {
			childExit = { code, signal, at: new Date().toISOString() };
			log(`App exited code=${code} signal=${signal}`);
		});
		child.on("error", (error) => {
			log(`App spawn error: ${error instanceof Error ? error.message : String(error)}`);
		});

		surface.launch = {
			pid: child.pid ?? null,
			debuggingPort,
			executablePath,
			appBundleDir,
			userDataDir,
			homeDir,
			args: spawnArgs,
			env: {
				AUREO_CERTIFICATION_MODE: "1",
				AUREO_CERTIFICATION_USER_DATA_DIR: userDataDir,
				AUREO_DEV_OPEN_RECORDING_INPUT: surfaceSpec.devOpenRecordingInput,
			},
			stdout: "",
			stderr: "",
			exit: null,
			isolation: null,
		};

		const versionUrl = `http://127.0.0.1:${debuggingPort}/json/version`;
		const listUrl = `http://127.0.0.1:${debuggingPort}/json/list`;
		log(`Waiting for DevTools endpoint ${versionUrl}`);
		const versionInfo = await waitForJson(versionUrl, LAUNCH_TIMEOUT_MS, "CDP /json/version");

		log(`Verifying isolated userData path ${userDataDir}`);
		surface.launch.isolation = await waitForUserDataIsolation(
			() => stdoutChunks.join(""),
			userDataDir,
			10000,
		);
		surface.findings.push({
			severity: "info",
			area: "isolation",
			message: `Packaged app used isolated userData at ${surface.launch.isolation.reportedPath}`,
		});

		const pageWaitStarted = Date.now();
		let exactTarget = null;
		let targets = [];
		let targetLookupError = null;
		while (Date.now() - pageWaitStarted < PAGE_READY_TIMEOUT_MS) {
			if (childExit) {
				fail(
					`App exited before surface "${surfaceSpec.id}" target became available (code=${childExit.code}, signal=${childExit.signal})`,
				);
			}
			targets = await waitForJson(listUrl, 5000, "CDP /json/list");
			const lookup = findExactPageTarget(targets, surfaceSpec.requiredQuery, surfaceSpec.id);
			if (lookup.target) {
				exactTarget = lookup.target;
				targetLookupError = null;
				break;
			}
			targetLookupError = lookup.error;
			await sleep(300);
		}
		if (!exactTarget?.webSocketDebuggerUrl) {
			fail(
				targetLookupError ||
					`No exact page target for surface "${surfaceSpec.id}" with query ${JSON.stringify(
						surfaceSpec.requiredQuery,
					)}. Targets: ${JSON.stringify(summarizeAllTargets(targets))}`,
			);
		}

		surface.target = {
			...summarizeTarget(exactTarget),
			requiredQuery: surfaceSpec.requiredQuery,
			browser: versionInfo,
			allTargets: summarizeAllTargets(targets),
		};

		log(
			`Connecting CDP WebSocket for target ${exactTarget.id} (${exactTarget.title}) url=${exactTarget.url}`,
		);
		client = new CdpClient(exactTarget.webSocketDebuggerUrl);
		await client.connect();

		await client.send("Page.enable");
		await client.send("Runtime.enable");
		await client.send("DOM.enable");
		const ready = await waitForDocumentReady(
			client,
			undefined,
			PAGE_READY_TIMEOUT_MS,
			surfaceSpec.readiness,
		);
		log(
			`Document ready: title=${JSON.stringify(ready.title)} state=${ready.readyState} interactive=${ready.interactiveCount ?? "?"}`,
		);

		// Re-query target metadata after readiness so report captures settled title/url.
		try {
			const settledTargets = await waitForJson(listUrl, 5000, "CDP /json/list");
			const settledLookup = findExactPageTarget(
				settledTargets,
				surfaceSpec.requiredQuery,
				surfaceSpec.id,
			);
			if (settledLookup.target) {
				const settled = settledLookup.target;
				if (settled.id !== exactTarget.id) {
					fail(
						`Surface "${surfaceSpec.id}" target id changed after readiness: ${exactTarget.id} -> ${settled.id}`,
					);
				}
				surface.target = {
					...surface.target,
					...summarizeTarget(settled),
					requiredQuery: surfaceSpec.requiredQuery,
					browser: versionInfo,
					allTargets: summarizeAllTargets(settledTargets),
				};
			} else if (settledLookup.error) {
				fail(settledLookup.error);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes("[certify-electron-ui]")) {
				throw error;
			}
			// Non-fatal: keep the launch-time target snapshot for transient list failures.
		}

		log("Collecting DOM audit");
		surface.domAudit = await collectDomAudit(client, undefined);
		if (surface.domAudit.duplicateIds?.length) {
			surface.findings.push({
				severity: "warning",
				area: "dom",
				message: `Found ${surface.domAudit.duplicateIds.length} duplicate id value(s)`,
			});
		}
		if (surface.domAudit.visibleInteractiveMissingAccessibleNameCount > 0) {
			surface.findings.push({
				severity: "warning",
				area: "dom",
				message: `${surface.domAudit.visibleInteractiveMissingAccessibleNameCount} visible interactive element(s) lack a usable accessible name`,
			});
		}

		log("Collecting Accessibility.getFullAXTree summary");
		surface.accessibility = await collectAccessibility(client, undefined);
		if (surface.accessibility.interactiveNodesWithEmptyNameCount > 0) {
			surface.findings.push({
				severity: "warning",
				area: "accessibility",
				message: `${surface.accessibility.interactiveNodesWithEmptyNameCount} interactive AX node(s) have empty names`,
			});
		}

		log(`Collecting keyboard traversal (${TAB_PRESSES} Tab presses)`);
		surface.keyboardTraversal = await collectTabTraversal(client, undefined, TAB_PRESSES);
		surface.findings.push({
			severity: "info",
			area: "keyboard",
			message: `Recorded ${surface.keyboardTraversal.presses} Tab presses across ${surface.keyboardTraversal.uniqueFocusedElementCount} unique focused element(s)`,
		});

		log("Capturing emulated-media screenshots");
		surface.screenshots = await collectScreenshots(
			client,
			undefined,
			reportDir,
			surfaceSpec.id,
		);
		surface.findings.push({
			severity: "info",
			area: "screenshots",
			message: `Captured ${surface.screenshots.length} emulated-media screenshot(s)`,
		});

		log("Collecting Performance.getMetrics and multi-sample rAF evidence");
		surface.performance = await collectPerformance(client, undefined);
		const rafAggregate = surface.performance.rafAggregate ?? surface.performance.rafSample;
		const spikeThresholdMs = rafAggregate?.spikeThresholdMs ?? RAF_SPIKE_THRESHOLD_MS;
		const samplesWithSpike =
			rafAggregate?.samplesWithMaxSpikeGteThresholdMs ??
			(Array.isArray(surface.performance.rafSamples)
				? surface.performance.rafSamples.filter(
						(sample) => (sample?.maxFrameIntervalMs ?? 0) >= spikeThresholdMs,
					).length
				: 0);
		const sampleCount =
			rafAggregate?.sampleCount ??
			(Array.isArray(surface.performance.rafSamples)
				? surface.performance.rafSamples.length
				: 0);
		const sampleMaxes = Array.isArray(surface.performance.rafSamples)
			? surface.performance.rafSamples
					.map((sample) => sample?.maxFrameIntervalMs)
					.filter((value) => typeof value === "number")
			: [];
		surface.findings.push({
			severity: "info",
			area: "performance",
			message: `RAF aggregate samples=${sampleCount}, totalDurationMs=${rafAggregate?.totalDurationMs ?? "n/a"}, p95=${rafAggregate?.p95FrameIntervalMs ?? "n/a"}, max=${rafAggregate?.maxFrameIntervalMs ?? "n/a"}, sampleMaxes=[${sampleMaxes.join(", ")}]`,
		});
		if (samplesWithSpike >= 2) {
			surface.findings.push({
				severity: "warning",
				area: "performance",
				message: `Repeated rAF max spike >=${spikeThresholdMs}ms in ${samplesWithSpike}/${sampleCount} independent samples (not isolated)`,
			});
		} else if (samplesWithSpike === 1) {
			surface.findings.push({
				severity: "warning",
				area: "performance",
				message: `Isolated rAF max spike >=${spikeThresholdMs}ms in 1/${sampleCount} independent samples (not repeated across samples)`,
			});
		}

		surface.status = "completed";
		surface.launch.stdout = stdoutChunks.join("");
		surface.launch.stderr = stderrChunks.join("");
		surface.launch.exit = childExit;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		surface.status = "failed";
		surface.errors.push(message);
		surface.findings.push({
			severity: "error",
			area: "harness",
			message,
		});
		log(`FAILED: ${message}`);
		throw error;
	} finally {
		// Prefer graceful browser shutdown while CDP is still connected, then
		// close the socket, then fall back to SIGTERM/SIGKILL if needed.
		if (client) {
			await requestBrowserClose(client, log);
			await sleep(400);
			try {
				await client.close();
			} catch {
				// ignore
			}
			client = null;
		}

		if (child) {
			await terminateChildProcess(child, log);
			if (surface.launch) {
				surface.launch.exit = {
					code: child.exitCode,
					signal: child.signalCode,
					at: new Date().toISOString(),
				};
				if (!surface.launch.stdout) {
					// Best-effort; stdout may already be filled on success.
				}
			}
		}

		deleteTempDir(homeDir, log);
		surface.finishedAt = new Date().toISOString();
		surface.launchLogs = launchLogs;
	}

	return surface;
}

async function main() {
	if (process.platform !== "darwin") {
		fail("This harness currently supports macOS only (ditto + signed .app extraction).");
	}

	const archivePath = path.resolve(process.argv[2] ?? DEFAULT_ZIP);
	if (!existsSync(archivePath)) {
		fail(`Release archive not found: ${archivePath}`);
	}

	const reportStamp = nowIsoSafe();
	const reportDir = path.join(releaseRoot, "ui-ux-certification", reportStamp);
	mkdirSync(reportDir, { recursive: true });

	const launchLogs = [];
	const log = (line) => {
		const entry = line.startsWith("[") ? line : `[${new Date().toISOString()}] ${line}`;
		launchLogs.push(entry);
		console.error(entry);
	};

	let extractDir = null;
	let exitCode = 0;
	const report = {
		kind: "automated-electron-ui-certification",
		disclaimer,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		platform: process.platform,
		arch: process.arch,
		node: process.version,
		productName,
		packageVersion: packageJson.version ?? null,
		archivePath,
		reportDir,
		codesign: null,
		surfaces: {
			launch: createEmptySurfaceReport("launch"),
			editor: createEmptySurfaceReport("editor"),
		},
		findings: [],
		errors: [],
		launchLogs: [],
		status: "running",
	};

	const writeReport = () => {
		report.finishedAt = new Date().toISOString();
		report.launchLogs = launchLogs;
		const reportPath = path.join(reportDir, "report.json");
		writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
		return reportPath;
	};

	try {
		extractDir = mkdtempSync(path.join(tmpdir(), "aureo-ui-cert-extract-"));
		log(`Extracting ${relativePath(archivePath)} with /usr/bin/ditto to ${extractDir}`);
		await execFileAsync("/usr/bin/ditto", ["-x", "-k", archivePath, extractDir], {
			timeout: 300000,
			maxBuffer: 1024 * 1024,
		});

		const appBundleDir = findAppBundle(extractDir);
		if (!appBundleDir) {
			fail(`No .app bundle found after extracting ${relativePath(archivePath)}`);
		}
		const executablePath = resolveExecutable(appBundleDir);
		if (!executablePath) {
			fail(`Packaged executable not found under ${appBundleDir}`);
		}

		log(`Verifying codesign --deep --strict for ${appBundleDir}`);
		const codesign = await verifyCodesign(appBundleDir);
		report.codesign = {
			...codesign,
			appBundleDir,
			executablePath,
		};
		if (!codesign.ok) {
			report.findings.push({
				severity: "error",
				area: "codesign",
				message: "Deep strict codesign verification failed",
			});
			fail(`codesign verification failed:\n${codesign.output}`);
		}
		report.findings.push({
			severity: "info",
			area: "codesign",
			message: "Deep strict codesign verification passed",
		});

		const surfaceSpecs = createSurfaceSpecs(appBundleDir);
		for (const surfaceSpec of surfaceSpecs) {
			log(`Starting isolated surface certification: ${surfaceSpec.id}`);
			try {
				const surfaceReport = await certifySurface({
					surfaceSpec,
					appBundleDir,
					executablePath,
					reportDir,
					extractDir,
					parentLog: log,
				});
				report.surfaces[surfaceSpec.id] = surfaceReport;
				for (const finding of surfaceReport.findings) {
					report.findings.push({
						...finding,
						surface: surfaceSpec.id,
					});
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				// Surface report is already filled by certifySurface on failure when available.
				if (
					!report.surfaces[surfaceSpec.id] ||
					report.surfaces[surfaceSpec.id].status !== "failed"
				) {
					report.surfaces[surfaceSpec.id] = {
						...createEmptySurfaceReport(surfaceSpec.id),
						status: "failed",
						startedAt: new Date().toISOString(),
						finishedAt: new Date().toISOString(),
						errors: [message],
						findings: [
							{
								severity: "error",
								area: "harness",
								message,
							},
						],
					};
				}
				report.errors.push(`[${surfaceSpec.id}] ${message}`);
				report.findings.push({
					severity: "error",
					area: "harness",
					surface: surfaceSpec.id,
					message,
				});
				throw error;
			}
		}

		const allCompleted = surfaceSpecs.every(
			(surfaceSpec) => report.surfaces[surfaceSpec.id]?.status === "completed",
		);
		report.status = allCompleted ? "completed" : "failed";
	} catch (error) {
		exitCode = 1;
		const message = error instanceof Error ? error.message : String(error);
		report.status = "failed";
		if (
			!report.errors.includes(message) &&
			!report.errors.some((entry) => entry.endsWith(message))
		) {
			report.errors.push(message);
		}
		if (
			!report.findings.some(
				(finding) => finding.area === "harness" && finding.message === message,
			)
		) {
			report.findings.push({
				severity: "error",
				area: "harness",
				message,
			});
		}
		log(`FAILED: ${message}`);
	} finally {
		deleteTempDir(extractDir, log);

		const reportPath = writeReport();
		// Preserve report output and print the path for callers.
		console.log(reportDir);
		console.error(`[certify-electron-ui] report: ${reportPath}`);
		console.error(`[certify-electron-ui] status: ${report.status}`);
		console.error(`[certify-electron-ui] ${disclaimer}`);
	}

	process.exit(exitCode);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[certify-electron-ui] fatal: ${message}`);
	process.exit(1);
});

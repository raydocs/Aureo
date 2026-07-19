import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const fixtureRoot = path.join(root, "fixtures", "release-v1");
const checksumPath = path.join(fixtureRoot, "CHECKSUMS.sha256");
const verifyOnly = process.argv.includes("--verify");

const generatedFiles = [
	"media/gif-boundary-input.mp4",
	"media/mixed-audio.mp4",
	"media/sidecars/primary.mp4",
	"media/sidecars/primary.mic.m4a",
	"media/sidecars/primary.system.m4a",
	"media/sidecars/primary-webcam.mp4",
	"projects/corrupt-primary.aureo",
	"projects/corrupt-primary.aureo.bak",
	"projects/future-version.aureo",
	"projects/long-timeline.aureo",
	"projects/missing-media.aureo",
	"projects/valid-v1.aureo",
];

const supersededGeneratedFiles = [
	"media/sidecars/microphone.wav",
	"media/sidecars/system-audio.wav",
	"media/sidecars/webcam.mp4",
];

function project(editor = {}, videoPath = "__FIXTURE_ROOT__/media/mixed-audio.mp4") {
	return {
		version: 1,
		projectId: "fixture-project-v1",
		videoPath,
		editor: {
			zoomRegions: [],
			trimRegions: [],
			clipRegions: [{ id: "clip-1", startMs: 0, endMs: 4_000, speed: 1 }],
			speedRegions: [],
			annotationRegions: [],
			audioRegions: [],
			autoCaptions: [],
			...editor,
		},
	};
}

function createLongTimelineProject() {
	const clipRegions = Array.from({ length: 120 }, (_, index) => ({
		id: `clip-${index + 1}`,
		startMs: index * 5_000,
		endMs: (index + 1) * 5_000,
		speed: 1,
		showSourceAudio: true,
	}));
	const zoomRegions = Array.from({ length: 60 }, (_, index) => ({
		id: `zoom-${index + 1}`,
		startMs: index * 10_000 + 1_000,
		endMs: index * 10_000 + 4_000,
		depth: (index % 3) + 2,
		focus: { cx: 0.25 + (index % 3) * 0.25, cy: 0.35 + (index % 2) * 0.3 },
		mode: index % 4 === 0 ? "instant" : "auto",
	}));
	const speedRegions = Array.from({ length: 40 }, (_, index) => ({
		id: `speed-${index + 1}`,
		startMs: index * 15_000 + 5_000,
		endMs: index * 15_000 + 8_000,
		speed: index % 2 === 0 ? 1.5 : 2,
	}));
	const annotationRegions = Array.from({ length: 30 }, (_, index) => ({
		id: `annotation-${index + 1}`,
		startMs: index * 20_000 + 2_000,
		endMs: index * 20_000 + 7_000,
		type: "text",
		content: `Fixture annotation ${index + 1}`,
		position: { x: 50, y: 20 + (index % 4) * 20 },
		size: { width: 30, height: 12 },
		style: {
			color: "#FFFFFF",
			backgroundColor: "#000000",
			fontSize: 32,
			fontFamily: "SF Pro Text",
			fontWeight: "bold",
			fontStyle: "normal",
			textDecoration: "none",
			textAlign: "center",
			borderRadius: 8,
		},
		zIndex: index,
		trackIndex: index % 3,
	}));
	const autoCaptions = Array.from({ length: 80 }, (_, index) => ({
		id: `caption-${index + 1}`,
		startMs: index * 7_500,
		endMs: index * 7_500 + 2_500,
		text: `Deterministic caption ${index + 1}`,
	}));
	const audioRegions = Array.from({ length: 20 }, (_, index) => ({
		id: `audio-${index + 1}`,
		startMs: index * 30_000,
		endMs: index * 30_000 + 10_000,
		audioPath: "__FIXTURE_ROOT__/media/sidecars/primary.system.m4a",
		volume: 0.8,
		trackIndex: index % 2,
	}));

	return project(
		{
			clipRegions,
			zoomRegions,
			speedRegions,
			annotationRegions,
			autoCaptions,
			audioRegions,
			webcam: {
				enabled: true,
				sourcePath: "__FIXTURE_ROOT__/media/sidecars/primary-webcam.mp4",
				layouts: Array.from({ length: 24 }, (_, index) => ({
					id: `webcam-layout-${index + 1}`,
					startMs: index * 25_000,
					endMs: index * 25_000 + 8_000,
					mode: index % 3 === 0 ? "fullscreen" : "default",
				})),
			},
			sourceAudioTrackSettingsByClip: Object.fromEntries(
				clipRegions.map((clip) => [
					clip.id,
					{
						mic: { volume: 0.9, normalize: false },
						system: { volume: 0.8, normalize: false },
					},
				]),
			),
		},
		"__FIXTURE_ROOT__/media/sidecars/primary.mp4",
	);
}

async function writeJson(relativePath, value) {
	const targetPath = path.join(fixtureRoot, relativePath);
	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

async function runFfmpeg(relativePath, args) {
	if (typeof ffmpegPath !== "string" || ffmpegPath.length === 0) {
		throw new Error("ffmpeg-static is unavailable for this platform");
	}

	const targetPath = path.join(fixtureRoot, relativePath);
	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	await execFileAsync(
		ffmpegPath,
		[
			"-y",
			"-hide_banner",
			"-loglevel",
			"error",
			"-fflags",
			"+bitexact",
			...args,
			"-map_metadata",
			"-1",
			targetPath,
		],
		{ timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
	);
}

async function generate() {
	await Promise.all(
		supersededGeneratedFiles.map((relativePath) =>
			fs.rm(path.join(fixtureRoot, relativePath), { force: true }),
		),
	);

	await runFfmpeg("media/mixed-audio.mp4", [
		"-f",
		"lavfi",
		"-i",
		"testsrc2=size=640x360:rate=30",
		"-f",
		"lavfi",
		"-i",
		"sine=frequency=440:sample_rate=48000",
		"-f",
		"lavfi",
		"-i",
		"sine=frequency=660:sample_rate=48000",
		"-filter_complex",
		"[1:a][2:a]amix=inputs=2:normalize=0[mixed]",
		"-map",
		"0:v",
		"-map",
		"[mixed]",
		"-t",
		"4",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-pix_fmt",
		"yuv420p",
		"-flags:v",
		"+bitexact",
		"-c:a",
		"aac",
		"-flags:a",
		"+bitexact",
		"-movflags",
		"+faststart",
	]);

	await runFfmpeg("media/sidecars/primary.mp4", [
		"-f",
		"lavfi",
		"-i",
		"testsrc2=size=640x360:rate=2",
		"-t",
		"600",
		"-an",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-crf",
		"32",
		"-g",
		"20",
		"-pix_fmt",
		"yuv420p",
		"-flags:v",
		"+bitexact",
		"-movflags",
		"+faststart",
	]);

	await runFfmpeg("media/sidecars/primary-webcam.mp4", [
		"-f",
		"lavfi",
		"-i",
		"testsrc=size=320x180:rate=2",
		"-t",
		"600",
		"-an",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-crf",
		"30",
		"-g",
		"20",
		"-pix_fmt",
		"yuv420p",
		"-flags:v",
		"+bitexact",
		"-movflags",
		"+faststart",
	]);

	for (const [fileName, frequency] of [
		["primary.mic.m4a", 440],
		["primary.system.m4a", 660],
	]) {
		await runFfmpeg(`media/sidecars/${fileName}`, [
			"-f",
			"lavfi",
			"-i",
			`sine=frequency=${frequency}:sample_rate=48000`,
			"-t",
			"600",
			"-c:a",
			"aac",
			"-b:a",
			"48k",
			"-flags:a",
			"+bitexact",
		]);
	}

	await runFfmpeg("media/gif-boundary-input.mp4", [
		"-f",
		"lavfi",
		"-i",
		"testsrc2=size=1280x720:rate=15",
		"-t",
		"10",
		"-an",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-pix_fmt",
		"yuv420p",
		"-flags:v",
		"+bitexact",
		"-movflags",
		"+faststart",
	]);

	const validProject = project();
	await writeJson("projects/valid-v1.aureo", validProject);
	await writeJson("projects/future-version.aureo", { ...validProject, version: 2 });
	await writeJson("projects/corrupt-primary.aureo.bak", {
		...validProject,
		projectId: "fixture-recovery-backup",
	});
	await fs.writeFile(
		path.join(fixtureRoot, "projects", "corrupt-primary.aureo"),
		'{"version":1,"projectId":"fixture-corrupt",\n',
	);
	await writeJson(
		"projects/missing-media.aureo",
		project({}, "__FIXTURE_ROOT__/media/moved-or-missing-primary.mp4"),
	);
	await writeJson("projects/long-timeline.aureo", createLongTimelineProject());

	await writeChecksums();
}

async function sha256(relativePath) {
	const contents = await fs.readFile(path.join(fixtureRoot, relativePath));
	return crypto.createHash("sha256").update(contents).digest("hex");
}

async function writeChecksums() {
	const lines = await Promise.all(
		generatedFiles.map(
			async (relativePath) => `${await sha256(relativePath)}  ${relativePath}`,
		),
	);
	await fs.writeFile(checksumPath, `${lines.join("\n")}\n`);
}

async function listFixturePayloadFiles(relativeDirectory) {
	const entries = await fs.readdir(path.join(fixtureRoot, relativeDirectory), {
		withFileTypes: true,
	});
	const files = [];
	for (const entry of entries) {
		const relativePath = path.posix.join(relativeDirectory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFixturePayloadFiles(relativePath)));
		} else if (entry.isFile()) {
			files.push(relativePath);
		} else {
			throw new Error(`Fixture payload contains unsupported entry: ${relativePath}`);
		}
	}
	return files;
}

async function readProjectFixture(relativePath) {
	return JSON.parse(await fs.readFile(path.join(fixtureRoot, relativePath), "utf8"));
}

async function verifyProjectContracts() {
	const validProject = await readProjectFixture("projects/valid-v1.aureo");
	const futureProject = await readProjectFixture("projects/future-version.aureo");
	const longProject = await readProjectFixture("projects/long-timeline.aureo");
	const missingMediaProject = await readProjectFixture("projects/missing-media.aureo");

	if (validProject.version !== 1 || futureProject.version <= validProject.version) {
		throw new Error("Project version fixtures do not represent current and future versions");
	}
	if (!missingMediaProject.videoPath.includes("moved-or-missing")) {
		throw new Error("Missing-media fixture does not reference absent media");
	}

	const longClips = longProject.editor?.clipRegions;
	if (
		!Array.isArray(longClips) ||
		longClips.length !== 120 ||
		Math.max(...longClips.map((clip) => clip.endMs)) !== 600_000
	) {
		throw new Error("Long-timeline fixture does not cover ten minutes with 120 clips");
	}
	if (
		longProject.videoPath !== "__FIXTURE_ROOT__/media/sidecars/primary.mp4" ||
		longProject.editor?.webcam?.sourcePath !==
			"__FIXTURE_ROOT__/media/sidecars/primary-webcam.mp4"
	) {
		throw new Error("Long-timeline fixture does not reference the discoverable sidecar bundle");
	}

	const sourceAudioSettingsByClip = longProject.editor?.sourceAudioTrackSettingsByClip ?? {};
	const sourceSettings = Object.values(sourceAudioSettingsByClip);
	if (
		sourceSettings.length !== longClips.length ||
		Object.keys(sourceAudioSettingsByClip).sort().join("\n") !==
			longClips
				.map((clip) => clip.id)
				.sort()
				.join("\n") ||
		sourceSettings.some(
			(settings) =>
				typeof settings?.mic?.volume !== "number" ||
				typeof settings?.mic?.normalize !== "boolean" ||
				typeof settings?.system?.volume !== "number" ||
				typeof settings?.system?.normalize !== "boolean",
		)
	) {
		throw new Error("Long-timeline source-audio settings do not match the persisted contract");
	}

	let corruptPrimaryRejected = false;
	try {
		await readProjectFixture("projects/corrupt-primary.aureo");
	} catch {
		corruptPrimaryRejected = true;
	}
	if (!corruptPrimaryRejected) {
		throw new Error("Corrupt-primary fixture unexpectedly contains valid JSON");
	}
	await readProjectFixture("projects/corrupt-primary.aureo.bak");
}

async function verifyMediaContracts() {
	const expectedMedia = [
		["media/mixed-audio.mp4", 4, ["video", "audio"]],
		["media/gif-boundary-input.mp4", 10, ["video"]],
		["media/sidecars/primary.mp4", 600, ["video"]],
		["media/sidecars/primary.mic.m4a", 600, ["audio"]],
		["media/sidecars/primary.system.m4a", 600, ["audio"]],
		["media/sidecars/primary-webcam.mp4", 600, ["video"]],
	];

	for (const [relativePath, expectedDuration, expectedStreamTypes] of expectedMedia) {
		const { stdout } = await execFileAsync(
			ffprobeStatic.path,
			[
				"-v",
				"error",
				"-show_entries",
				"format=duration:stream=codec_type",
				"-of",
				"json",
				path.join(fixtureRoot, relativePath),
			],
			{ timeout: 30_000, maxBuffer: 1024 * 1024 },
		);
		const probe = JSON.parse(stdout);
		const duration = Number.parseFloat(probe.format?.duration);
		const streamTypes = (probe.streams ?? []).map((stream) => stream.codec_type).sort();
		if (
			!Number.isFinite(duration) ||
			Math.abs(duration - expectedDuration) > 0.05 ||
			streamTypes.join("\n") !== [...expectedStreamTypes].sort().join("\n")
		) {
			throw new Error(
				`Media fixture does not match its duration/stream contract: ${relativePath}`,
			);
		}
	}
}

async function verify() {
	const expectedLines = (await fs.readFile(checksumPath, "utf8")).trim().split("\n");
	const expected = new Map(expectedLines.map((line) => [line.slice(66), line.slice(0, 64)]));

	if (expected.size !== generatedFiles.length) {
		throw new Error(
			`Fixture checksum manifest contains ${expected.size} entries; expected ${generatedFiles.length}`,
		);
	}

	const actualFiles = [
		...(await listFixturePayloadFiles("media")),
		...(await listFixturePayloadFiles("projects")),
	].sort();
	if (actualFiles.join("\n") !== [...generatedFiles].sort().join("\n")) {
		throw new Error("Fixture payload contains missing, unexpected, or superseded files");
	}

	for (const relativePath of generatedFiles) {
		const actualHash = await sha256(relativePath);
		if (expected.get(relativePath) !== actualHash) {
			throw new Error(`Fixture checksum mismatch: ${relativePath}`);
		}
	}
	await verifyProjectContracts();
	await verifyMediaContracts();

	console.log(`Verified ${generatedFiles.length} release fixtures.`);
}

if (verifyOnly) {
	await verify();
} else {
	await generate();
	await verify();
}

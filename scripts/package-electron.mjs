import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const electronBuilderCli = path.join(projectDir, "node_modules", "electron-builder", "cli.js");
const builderArgs = process.argv.slice(2);

function runElectronBuilder(args) {
	const result = spawnSync(process.execPath, [electronBuilderCli, ...args], {
		cwd: projectDir,
		stdio: "inherit",
		env: process.env,
	});

	if (result.error) throw result.error;
	return result.status ?? 1;
}

async function copyArtifacts(stagingDir) {
	const releaseDir = path.join(projectDir, "release");
	await mkdir(releaseDir, { recursive: true });

	const entries = await readdir(stagingDir, { withFileTypes: true });
	const artifacts = entries.filter((entry) => entry.isFile());
	if (artifacts.length === 0) {
		throw new Error(`Electron Builder produced no artifacts in ${stagingDir}`);
	}

	for (const artifact of artifacts) {
		const source = path.join(stagingDir, artifact.name);
		const destination = path.join(releaseDir, artifact.name);
		const temporaryDestination = `${destination}.tmp-${process.pid}`;
		await copyFile(source, temporaryDestination);
		await rename(temporaryDestination, destination);
	}

	console.log(
		`[package-electron] Copied ${artifacts.length} signed artifact(s) to ${releaseDir}`,
	);
}

if (process.platform !== "darwin" || process.env.AUREO_PACKAGE_IN_PLACE === "1") {
	process.exit(runElectronBuilder(builderArgs));
}

const stagingDir = await mkdtemp(path.join(tmpdir(), "aureo-electron-builder-"));
const status = runElectronBuilder([...builderArgs, `--config.directories.output=${stagingDir}`]);

if (status !== 0) {
	console.error(
		`[package-electron] Packaging failed; preserving staging output at ${stagingDir}`,
	);
	process.exit(status);
}

try {
	await copyArtifacts(stagingDir);
	await rm(stagingDir, { recursive: true, force: true });
} catch (error) {
	console.error(
		`[package-electron] Could not publish artifacts; preserving staging output at ${stagingDir}`,
	);
	throw error;
}

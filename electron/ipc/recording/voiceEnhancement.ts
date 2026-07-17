import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";
import { resolveUnpackedAppPath } from "../paths/binaries";

export type VoiceEnhancementMode = "off" | "standard" | "strong";

export function normalizeVoiceEnhancementMode(value: unknown): VoiceEnhancementMode {
	return value === "off" || value === "strong" ? value : "standard";
}

function escapeFilterPath(value: string) {
	return value.replace(/([\\:,'[\]])/g, "\\$1");
}

export function getVoiceEnhancementFilters(mode: VoiceEnhancementMode, modelPath: string) {
	if (mode === "off") {
		return [];
	}

	const neuralDenoise = `arnndn=m=${escapeFilterPath(modelPath)}:mix=${
		mode === "strong" ? "1" : "0.88"
	}`;
	const filters = [mode === "strong" ? "highpass=f=85" : "highpass=f=70", neuralDenoise];

	if (mode === "strong") {
		filters.push("afftdn=nr=6:nf=-48:tn=1");
	}

	filters.push(
		"acompressor=threshold=0.125:ratio=2.5:attack=20:release=250:makeup=1.4",
		"loudnorm=I=-14:TP=-1.5:LRA=8",
		"alimiter=limit=0.95:level=0",
	);
	return filters;
}

function runFfmpeg(ffmpegPath: string, args: string[]) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
			if (stderr.length > 16_384) stderr = stderr.slice(-16_384);
		});
		child.once("error", reject);
		child.once("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(stderr.trim() || `FFmpeg voice enhancement failed (${code})`));
		});
	});
}

export async function enhanceMicrophoneRecording(
	inputPath: string,
	mode: VoiceEnhancementMode,
	outputPath = inputPath,
) {
	if (mode === "off") return { processed: false, path: outputPath };

	const modelPath = resolveUnpackedAppPath("electron", "native", "models", "rnnoise", "std.rnnn");
	await fs.access(modelPath);

	const extension = path.extname(outputPath) || ".m4a";
	const tempPath = path.join(
		path.dirname(outputPath),
		`.${path.basename(outputPath, extension)}.voice-${process.pid}-${Date.now()}${extension}`,
	);
	const filters = getVoiceEnhancementFilters(mode, modelPath);

	try {
		await runFfmpeg(getFfmpegBinaryPath(), [
			"-hide_banner",
			"-loglevel",
			"warning",
			"-y",
			"-i",
			inputPath,
			"-vn",
			"-af",
			filters.join(","),
			"-c:a",
			"aac",
			"-b:a",
			"160k",
			"-ar",
			"48000",
			"-movflags",
			"+faststart",
			tempPath,
		]);
		const stat = await fs.stat(tempPath);
		if (stat.size === 0) throw new Error("Voice enhancement produced an empty file");
		await fs.rename(tempPath, outputPath);
		return { processed: true, path: outputPath };
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
		throw error;
	}
}

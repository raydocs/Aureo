import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setNativeCaptureOutputBuffer, setNativeCaptureTargetPath } from "../state";
import { waitForNativeCaptureStop } from "./mac";

vi.mock("electron", () => ({
	app: {
		getPath: () => "/tmp/AureoTest",
		setPath: () => undefined,
	},
	BrowserWindow: {
		getAllWindows: () => [],
	},
}));

class FakeCaptureProcess extends EventEmitter {
	stdout = new PassThrough();
	stderr = new PassThrough();
	stdin = new PassThrough();
	killed = false;

	kill = vi.fn((signal?: NodeJS.Signals) => {
		this.killed = true;
		return true;
	});
}

describe("waitForNativeCaptureStop", () => {
	beforeEach(() => {
		setNativeCaptureOutputBuffer("");
		setNativeCaptureTargetPath(null);
	});

	it("resolves the helper output path when the process closes cleanly", async () => {
		const proc = new FakeCaptureProcess();
		setNativeCaptureOutputBuffer("Recording stopped. Output path: /tmp/Aureo/capture.mp4");

		const stopped = waitForNativeCaptureStop(
			proc as unknown as Parameters<typeof waitForNativeCaptureStop>[0],
			1000,
		);
		proc.emit("close", 0);

		await expect(stopped).resolves.toBe("/tmp/Aureo/capture.mp4");
		expect(proc.kill).not.toHaveBeenCalled();
	});

	it("resolves the fallback target path when the helper closes cleanly without output path", async () => {
		const proc = new FakeCaptureProcess();
		setNativeCaptureOutputBuffer("Recording stopped without output path");
		setNativeCaptureTargetPath("/tmp/Aureo/fallback.mp4");

		const stopped = waitForNativeCaptureStop(
			proc as unknown as Parameters<typeof waitForNativeCaptureStop>[0],
			1000,
		);
		proc.emit("close", 0);

		await expect(stopped).resolves.toBe("/tmp/Aureo/fallback.mp4");
		expect(proc.kill).not.toHaveBeenCalled();
	});

	it("rejects with helper output when the helper exits with a non-zero code", async () => {
		const proc = new FakeCaptureProcess();
		setNativeCaptureOutputBuffer("Encoder error: insufficient memory");

		const stopped = waitForNativeCaptureStop(
			proc as unknown as Parameters<typeof waitForNativeCaptureStop>[0],
			1000,
		);
		proc.emit("close", 1);

		await expect(stopped).rejects.toThrow("Encoder error: insufficient memory");
		expect(proc.kill).not.toHaveBeenCalled();
	});

	it("rejects when the helper emits an error and ignores a late close", async () => {
		const proc = new FakeCaptureProcess();
		const error = new Error("spawn failed");

		const stopped = waitForNativeCaptureStop(
			proc as unknown as Parameters<typeof waitForNativeCaptureStop>[0],
			1000,
		);
		proc.emit("error", error);

		await expect(stopped).rejects.toBe(error);
		expect(proc.kill).not.toHaveBeenCalled();

		// Late close after error settle must not reject/resolve again.
		proc.emit("close", 0);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(proc.listenerCount("close")).toBe(0);
		expect(proc.listenerCount("error")).toBe(0);
	});

	it("sends SIGTERM then SIGKILL and rejects with timeout when stop never completes", async () => {
		const proc = new FakeCaptureProcess();

		const stopped = waitForNativeCaptureStop(
			proc as unknown as Parameters<typeof waitForNativeCaptureStop>[0],
			10,
			10,
			10,
		);

		await new Promise((resolve) => setTimeout(resolve, 15));
		expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
		expect(proc.kill).not.toHaveBeenCalledWith("SIGKILL");

		await expect(stopped).rejects.toThrow(/timed out/i);
		expect(proc.kill).toHaveBeenCalledWith("SIGKILL");
		expect(proc.kill).toHaveBeenCalledTimes(2);
	});

	it("cancels SIGKILL when the helper closes during the termination grace period", async () => {
		const proc = new FakeCaptureProcess();

		const stopped = waitForNativeCaptureStop(
			proc as unknown as Parameters<typeof waitForNativeCaptureStop>[0],
			10,
			30,
			10,
		);

		await new Promise((resolve) => setTimeout(resolve, 15));
		expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
		proc.emit("close", 0);

		await expect(stopped).rejects.toThrow(/timed out/i);
		await new Promise((resolve) => setTimeout(resolve, 35));
		expect(proc.kill).not.toHaveBeenCalledWith("SIGKILL");
	});

	it("does not settle again when close arrives after forced timeout rejection", async () => {
		const proc = new FakeCaptureProcess();
		setNativeCaptureOutputBuffer("Recording stopped. Output path: /tmp/Aureo/late.mp4");

		const stopped = waitForNativeCaptureStop(
			proc as unknown as Parameters<typeof waitForNativeCaptureStop>[0],
			5,
			5,
			5,
		);

		await expect(stopped).rejects.toThrow(/timed out/i);

		proc.emit("close", 0);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(proc.listenerCount("close")).toBe(0);
		expect(proc.listenerCount("error")).toBe(0);
	});
});

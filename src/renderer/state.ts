import type { Ref } from "vue";
import { reactive, ref } from "vue";

const COVERART_RENDERING_CONCURRENCY = 10;

const electron = window.electron.ipcRenderer;

const state = reactive({
	allowedExtensions: [] as string[],
	queue: [] as string[],
	currentlyPlaying: 0,
	volume: 1,
	version: "",
	isPlaying: false,
	isMinimized: false,
	isMaximized: false,
	processQueue: 0,
});

export const useState = () => state;
export const useInvoke = () => electron.invoke;
export const defaultCover = ref();

export const syncWindowState = async () => {
	const windowState = await electron.invoke<{ isMinimized: boolean; isMaximized: boolean }>("sync-window-state");
	state.isMinimized = windowState.isMinimized;
	state.isMaximized = windowState.isMaximized;
};

electron.on("play-file", file => state.queue.push(file as string));
electron.on<(string)[]>("play-folder", (files) => {
	state.queue = spreadArray(files);
});
electron.on("maximize", () => state.isMaximized = true);
electron.on("unmaximize", () => state.isMaximized = false);

// These are constant state syncs that get emitted on startup from the main process
electron.on<string>("version", version => state.version = version);
electron.on<string[]>("allowed-extensions", allowedExtensions => state.allowedExtensions = allowedExtensions);
electron.on("default-cover", (image) => {
	defaultCover.value = URL.createObjectURL(new Blob([image as Buffer], { type: "image/png" }));
});

// recursively goes through every file in the folder and flattens it
function spreadArray(array: string[]): string[] {
	return array.reduce((acc, item) => {
		if (Array.isArray(item))
			return acc.concat(spreadArray(item));
		else
			return acc.concat(item);
	}, [] as string[]);
}

export const getCoverArt = async (path: string, ref: Ref<string>) => {
  if (state.processQueue < COVERART_RENDERING_CONCURRENCY) {
    state.processQueue++;
    try {
      ref.value = await window.electron.ipcRenderer.invoke<string>("get-cover", [path]);
    }
    catch (error) { }
    state.processQueue--;
  }
  else {
    setTimeout(async () =>
      getCoverArt(path, ref), 100,
    );
  }
};
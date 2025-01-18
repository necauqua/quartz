import path from "path"
import { accessSync, readFileSync } from "fs"

/**
 * All constants relating to helpers or handlers
 */
export const ORIGIN_NAME = "origin"
export const UPSTREAM_NAME = "upstream"
export const QUARTZ_SOURCE_BRANCH = "v4"

export const cwd = process.cwd()

function selectCacheDir() {
  try {
    const node_modules = path.join(cwd, "node_modules")
    accessSync(node_modules) // check if node_modules exists
    return path.join(node_modules, ".cache", "quartz")
  } catch {
    // standalone quartz bin?
    return path.join(cwd, ".quartz-cache")
  }
}

export const cacheDir = selectCacheDir()
export const cacheFile = path.join(cacheDir, "transpiled-build.mjs")
export const contentCacheFolder = path.join(cacheDir, "content-cache")

export const quartzRoot = path.resolve(import.meta.dirname, "..")
export const fp = path.join(quartzRoot, "build.ts")
export const { version } = JSON.parse(
  readFileSync(path.resolve(quartzRoot, "..", "package.json")).toString(),
)

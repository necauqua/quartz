#!/usr/bin/env node
import workerpool from "workerpool"
const cacheFile = process.argv[2]
const { parseMarkdown, processHtml } = await import(cacheFile)
workerpool.worker({
  parseMarkdown,
  processHtml,
})

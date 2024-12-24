import { QuartzTransformerPlugin } from "../types"
import {
  FullSlug,
  RelativeURL,
  SimpleSlug,
  TransformOptions,
  stripSlashes,
  simplifySlug,
  splitAnchor,
  transformLink,
} from "../../util/path"
import path from "path"
import { visit } from "unist-util-visit"
import isAbsoluteUrl from "is-absolute-url"
import { Root } from "hast"
import { wikilinkRegex } from "./ofm"

interface Options {
  /** How to resolve Markdown paths */
  markdownLinkResolution: TransformOptions["strategy"]
  /** Strips folders from a link so that it looks nice */
  prettyLinks: boolean
  openLinksInNewTab: boolean
  lazyLoad: boolean
  externalLinkIcon: boolean
  indexFrontmatterWikilinks: boolean
}

const defaultOptions: Options = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: false,
  lazyLoad: false,
  externalLinkIcon: true,
  indexFrontmatterWikilinks: false,
}

export function getFullInternalLink(dest: RelativeURL, fileSlug: SimpleSlug): FullSlug {
  // url.resolve is considered legacy
  // WHATWG equivalent https://nodejs.dev/en/api/v18/url/#urlresolvefrom-to
  const url = new URL(dest, "https://base.com/" + stripSlashes(fileSlug, true))
  const canonicalDest = url.pathname
  let [destCanonical, _destAnchor] = splitAnchor(canonicalDest)
  if (destCanonical.endsWith("/")) {
    destCanonical += "index"
  }
  // need to decodeURIComponent here as WHATWG URL percent-encodes everything
  return decodeURIComponent(stripSlashes(destCanonical, true)) as FullSlug
}

export const CrawlLinks: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "LinkProcessing",
    htmlPlugins(ctx) {
      return [
        () => {
          return (tree: Root, file) => {
            const curSlug = simplifySlug(file.data.slug!)
            const outgoing: Set<SimpleSlug> = new Set()

            const transformOptions: TransformOptions = {
              strategy: opts.markdownLinkResolution,
              allSlugs: ctx.allSlugs,
            }

            visit(tree, "element", (node, _index, _parent) => {
              // rewrite all links
              if (
                node.tagName === "a" &&
                node.properties &&
                typeof node.properties.href === "string"
              ) {
                let dest = node.properties.href as RelativeURL
                const classes = (node.properties.className ?? []) as string[]
                const isExternal = isAbsoluteUrl(dest)
                classes.push(isExternal ? "external" : "internal")

                if (isExternal && opts.externalLinkIcon) {
                  node.children.push({
                    type: "element",
                    tagName: "svg",
                    properties: {
                      "aria-hidden": "true",
                      class: "external-icon",
                      style: "max-width:0.8em;max-height:0.8em",
                      viewBox: "0 0 512 512",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "path",
                        properties: {
                          d: "M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z",
                        },
                        children: [],
                      },
                    ],
                  })
                }

                // Check if the link has alias text
                if (
                  node.children.length === 1 &&
                  node.children[0].type === "text" &&
                  node.children[0].value !== dest
                ) {
                  // Add the 'alias' class if the text content is not the same as the href
                  classes.push("alias")
                }
                node.properties.className = classes

                if (isExternal && opts.openLinksInNewTab) {
                  node.properties.target = "_blank"
                }

                // don't process external links or intra-document anchors
                const isInternal = !(isAbsoluteUrl(dest) || dest.startsWith("#"))
                if (isInternal) {
                  dest = node.properties.href = transformLink(
                    file.data.slug!,
                    dest,
                    transformOptions,
                  )

                  const full = getFullInternalLink(dest, curSlug)
                  const simple = simplifySlug(full)
                  outgoing.add(simple)
                  node.properties["data-slug"] = full
                }

                // rewrite link internals if prettylinks is on
                if (
                  opts.prettyLinks &&
                  isInternal &&
                  node.children.length === 1 &&
                  node.children[0].type === "text" &&
                  !node.children[0].value.startsWith("#")
                ) {
                  node.children[0].value = path.basename(node.children[0].value)
                }
              }

              // transform all other resources that may use links
              if (
                ["img", "video", "audio", "iframe"].includes(node.tagName) &&
                node.properties &&
                typeof node.properties.src === "string"
              ) {
                if (opts.lazyLoad) {
                  node.properties.loading = "lazy"
                }

                if (!isAbsoluteUrl(node.properties.src)) {
                  let dest = node.properties.src as RelativeURL
                  dest = node.properties.src = transformLink(
                    file.data.slug!,
                    dest,
                    transformOptions,
                  )
                  node.properties.src = dest
                }
              }
            })

            if (opts.indexFrontmatterWikilinks) {
              const strings = Object.values(file.data.frontmatter ?? {})
                .flatMap((vs) => (Array.isArray(vs) ? vs : [vs]))
                .filter((v) => typeof v === "string")

              for (const string of strings) {
                // the regex is /g so we have to do this to get the captures
                // exec doesn't work because it's stateful and so returns null every other time (very bad)
                // we do all of that to reuse the wikilinkRegex from ofm
                const [captures] = [...string.matchAll(wikilinkRegex)]
                if (!captures || captures[0] != string || string.startsWith("!")) {
                  // not matched, or didn't match the whole string, or is the embed syntax for some reason,
                  // which doesn't make sense to support in frontmatter
                  continue
                }
                const [_, rawFp, rawHeader] = captures
                const fp = rawFp?.trim() ?? ""
                const anchor = rawHeader?.trim() ?? ""
                const dest = transformLink(file.data.slug!, fp + anchor, transformOptions)
                const full = getFullInternalLink(dest, curSlug)
                const simple = simplifySlug(full)
                outgoing.add(simple)
              }
            }

            file.data.links = [...outgoing]
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    links: SimpleSlug[]
  }
}

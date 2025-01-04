import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { ProcessedContent, QuartzPluginData, defaultProcessedContent } from "../vfile"
import { FullPageLayout } from "../../cfg"
import {
  FilePath,
  FullSlug,
  getAllSegmentPrefixes,
  joinSegments,
  pathToRoot,
  slugTag,
} from "../../util/path"
import { defaultListPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { TagContent } from "../../components"
import { write } from "./helpers"
import { i18n } from "../../i18n"
import DepGraph from "../../depgraph"

interface TagPageOptions extends FullPageLayout {
  sort?: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

export const TagPage: QuartzEmitterPlugin<Partial<TagPageOptions>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: TagContent({ sort: userOpts?.sort }),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "TagPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async getDependencyGraph(ctx, content, _resources) {
      const graph = new DepGraph<FilePath>()

      for (const [_tree, file] of content) {
        const sourcePath = file.data.filePath!
        const tags = (file.data.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes)
        // if the file has at least one tag, it is used in the tag index page
        if (tags.length > 0) {
          tags.push("index")
        }

        for (const tag of tags) {
          graph.addEdge(
            sourcePath,
            joinSegments(ctx.argv.output, "tags", slugTag(tag) + ".html") as FilePath,
          )
        }
      }

      return graph
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      const fps: FilePath[] = []
      const allFiles = content.map((c) => c[1].data)
      const cfg = ctx.cfg.configuration

      const tags: Set<string> = new Set(
        allFiles.flatMap((data) => data.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes),
      )

      const tagDescriptions: Map<FullSlug, { tag: string; content: ProcessedContent }> = new Map(
        [...tags].map((tag) => {
          const title = `${i18n(cfg.locale).pages.tagContent.tag}: ${tag}`
          const slug = joinSegments("tags", slugTag(tag)) as FullSlug
          const content = defaultProcessedContent({ slug, frontmatter: { title } })
          return [slug, { tag, content }]
        }),
      )

      // add base tag
      tagDescriptions.set("tags/index" as FullSlug, {
        tag: "index",
        content: defaultProcessedContent({
          slug: "tags/index" as FullSlug,
          frontmatter: {
            title: i18n(cfg.locale).pages.tagContent.tagIndex,
          },
        }),
      })

      let tagFolder: string | undefined

      for (const [tree, file] of content) {
        const slug = file.data.slug!
        if (!slug.startsWith("tags/")) {
          continue
        }
        const desc = tagDescriptions.get(slug)
        if (!desc) {
          continue
        }
        desc.content = [tree, file]
        if (file.data.frontmatter?.title === desc.tag) {
          file.data.frontmatter.title = `${i18n(cfg.locale).pages.tagContent.tag}: ${desc.tag}`
        }
        if (!tagFolder && file.data.relativePath) {
          tagFolder = file.data.relativePath.split("/").at(0)
        }
      }

      // this is a hack to make sure our virtual `tags/index` page has the same folder as the other tag pages
      // so that the breadcrumbs render consistent capitalization etc
      if (tagFolder) {
        const path = `${tagFolder}/index.html` as FilePath
        tagDescriptions.get("tags/index" as FullSlug)!.content[1].data.relativePath = path
      }

      for (const [slug, desc] of tagDescriptions.entries()) {
        const [tree, file] = desc.content
        const externalResources = pageResources(pathToRoot(slug as FullSlug), file.data, resources)
        const componentData: QuartzComponentProps = {
          ctx,
          fileData: file.data,
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
        }

        const content = renderPage(cfg, slug, componentData, opts, externalResources)
        const fp = await write({
          ctx,
          content,
          slug: file.data.slug!,
          ext: ".html",
        })

        fps.push(fp)
      }
      return fps
    },
  }
}

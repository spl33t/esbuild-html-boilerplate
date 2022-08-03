import path from "path"
import fs from 'fs-extra';
import chokidar from 'chokidar'
import * as cheerio from "cheerio"
import { sendMessage } from "../../esbuild_dev"

async function copy(src, dest) {
    return fs.copy('', path.resolve("build/views/index.html"), {
        recursive: true
    }).catch(err => {
        console.error(err)
    })
}

const getHtmlContent = (absoluteFilePath) => {
    try {
        return fs.readFileSync(absoluteFilePath, {encoding: 'utf-8'})
    } catch (e) {
        throw new Error(`html-plugin: Unable to read template at ${ absoluteFilePath }`)
    }
}
const createStyleTag = (stylePath) => {

    const template = `<link href="${ path.normalize(stylePath) }" rel="stylesheet">`
    return template
}

const createScriptTag = (jsPath) => {
    const template = `<script src="${ path.normalize(jsPath) }" type="text/javascript"></script>`
    return template
}

const preparePaths = (outputs) => {
    return outputs.reduce((acc, path) => {
        const [js, css] = acc;
        const splittedFileName = path.split('/').pop();

        if (splittedFileName?.endsWith('.js')) {
            js.push(splittedFileName)
        } else if (splittedFileName?.endsWith('.css')) {
            css.push(splittedFileName)
        }

        return acc;
    }, [[], []])
}

const isLocalPath = (path) => {
    if (!path.includes('http')) return path
    if (path.includes('http')) return null
}

const srcToBuildPath = (pathFile) => {
    const parts = pathFile.split('\\')
    //fixme hardcode endpoints
    const srcIndex = parts.findIndex(e => e === 'src')
    parts[srcIndex] = 'build'
    return parts.join('\\')
}

export const HtmlPlugin = (options) => {
    const {
        absoluteFilePath = path.join(process.cwd(), options.indexHtml),
        absoluteFileDirPath = path.dirname(path.join(process.cwd(), options.indexHtml)),
        srcDir = path.join(process.cwd(), options.indexHtml.split('/')[1]),
        filename = path.basename(options.indexHtml),
        indexHtml,
        entryPoints = options.entryPoints
    } = options;

    const getLocalPathsArrayByHtmlElement = (htmlElements, attrName) => {
        let arr = []
        let paths = []

        //get only elemnts
        Object.keys(htmlElements).forEach(index => {
            if (!isNaN(index))
                return arr.push(htmlElements[index])
        })

        //filter remote src/href paths
        arr.forEach(element => {
            const src = element.attribs[attrName]
            if (isLocalPath(src)) {
                paths.push(src)
            }
        })

        //to absolute paths
        paths = paths.map((e, index) => {
            const absPath = `${ absoluteFileDirPath }/${ e }`
            return path.normalize(absPath)
        })

        return paths
    }

    const getAllHtmlPagesOnApp = (indexHtml,) => {
        const pagesPathsArray = [indexHtml]

        const recursive = (index = 0) => {
            const e = pagesPathsArray[index]
            const indexHtmlContent = getHtmlContent(e)
            const $document = cheerio.load(indexHtmlContent)
            const $links = $document('a')
            const childrenPagesArray = getLocalPathsArrayByHtmlElement($links, "href")
            if (childrenPagesArray.length !== 0) {
                pagesPathsArray.push(...childrenPagesArray)
                recursive(pagesPathsArray.length - 1)
            }
        }
        recursive()

        //fixme возмможно тут нужна оптимизация. и проверки на уровне пуша тк. кк. поподают не уникальные страницы
        return [...new Set(pagesPathsArray)]
    }

    const getAllAssetsOnPage = (htmlPath) => {
        const assetsArray = []

        const indexHtmlContent = getHtmlContent(htmlPath)
        const $document = cheerio.load(indexHtmlContent)
        const $imgs = $document('img')
        const childrenPagesArray = getLocalPathsArrayByHtmlElement($imgs, "src")

        if (childrenPagesArray.length !== 0) {
            assetsArray.push(...childrenPagesArray)
        }

        //fixme возмможно тут нужна оптимизация. и проверки на уровне пуша тк. кк. поподают не уникальные страницы
        return [...new Set(assetsArray)]
    }

    return {
        name: 'html-plugin',
        setup: async build => {
            const {
                entryPoints,
                outdir,
                metafile,
                distViewsPath = `${ build.initialOptions.outdir }/views/${ filename }`,
                distViewsDir = `${ build.initialOptions.outdir }/views`,
            } = build.initialOptions;
            if (!entryPoints) return

            if (!outdir)
                throw new Error('html-plugin: "outdir" esbuild build option is required');

            if (!metafile)
                throw new Error('html-plugin: "metafile" esbuild option must be set to "true"');

            build.onEnd(async result => {
                const {metafile} = result;
                if (!metafile) return

                const outputs = result.metafile.outputs;
                const [jsPath, cssPath] = preparePaths(Object.keys(outputs || {}));

                //fixme absoluteFilePath to absoluteIndeHtmlFilePath

                const renderHtml = (absPathToHtml) => {
                    const $document = cheerio.load(getHtmlContent(absPathToHtml))
                    const $head = $document('head')
                    const $body = $document('body')

                    cssPath.forEach(item => {
                        const relativePathStyle = `${ path.relative(path.dirname(srcToBuildPath(absPathToHtml)), outdir) }/${ item }`
                        $head.append(createStyleTag(relativePathStyle));
                    })

                    jsPath.forEach(item => {
                        const relativePathScript = `${ path.relative(path.dirname(srcToBuildPath(absPathToHtml)), outdir) }/${ item }`
                        $body.append(createScriptTag(relativePathScript));
                    })

                    $body.append(`<script>
                        const evtSource = new EventSource('http://localhost:3000/subscribe')
                        evtSource.onopen = function () { console.log('open') }
                        evtSource.onerror = function () { console.log('error') }
                        evtSource.onmessage = function () { 
                            console.log('message')
                            window.location.reload();
                        }
                     </script>`)

                    return $document.html()
                }

                const onFile = (srcFile) => {
                    let pagesPathsArray = getAllHtmlPagesOnApp(absoluteFilePath)
                    let assetsPathsArray = getAllAssetsOnPage(srcFile)

                    //write file
                     pagesPathsArray.forEach(pagePath => {
                         const html = renderHtml(pagePath)
                         let outputHtmlPath = srcToBuildPath(pagePath)

                         fs.outputFile(outputHtmlPath, html, 'utf8', function (err) {
                             if (err) {
                                 return console.log(err);
                             }
                         })
                     })

                    //Copy assets
                    assetsPathsArray.forEach(sourceFile => {
                        const parts = sourceFile.split('\\')
                        //fixme hardcode endpoints
                        const srcIndex = parts.findIndex(e => e === 'src')
                        parts[srcIndex] = 'build'
                        const buildFile = parts.join('\\')

                        fs.copy(sourceFile, buildFile, {
                            recursive: true
                        }).catch(err => {
                            console.error(err)
                        })
                    })
                }

                //fixme придумать название
                const fn = () => {
                    console.log('rebuild')
                    watcher.close()
                    result.rebuild()
                }

                const watcher = chokidar.watch(`${ srcDir }/views`, {persistent: true})
                    .on('change', fn)
                    .on("add", onFile)
            })
        }
    }
}
import { copyFile } from "fs/promises"
import fs from "fs"
import path from "path"

const copyFileToBuild = async (filePath, destPath) => {
    const parts = filePath.split('\\')
    const filename = parts[parts.length - 1]
    try {
        await copyFile(filePath, `${ destPath }/${ filename }`);
        //console.log(`${ filename } was copied to ${ destPath }/${ filename }`);
    } catch {
        console.log('The file could not be copied');
    }
}

export const HTMLPlugin = (viewsDir) => {
    return {
        name: 'HTMLPlugin',
        setup(build) {
            const outdir = build.initialOptions.outdir
            const buildHTMLDir = "views"

            build.onEnd(() => {
                try {
                    fs.mkdirSync(path.join(outdir, buildHTMLDir), { recursive: true })

                    fs.readdirSync(path.resolve(viewsDir))
                        .map(item => {
                            const extension = item.split('.')[item.split('.').length - 1]
                            return extension === "html" && path.resolve(`${ viewsDir }/${ item }`)
                        })
                        .forEach(filePath => copyFileToBuild(filePath, `${ outdir }/${ buildHTMLDir }`))
                    console.log('HTML скопирован')
                } catch (e) {
                    console.log('Не удалось скопировать HTML файлы')
                }
            })
        }
    }
}
import { rm } from "fs/promises"

export const CleanPlugin = {
    name: 'CleanPlugin',
    setup(build) {
        build.onStart(async () => {
            try {
                const outdir = build.initialOptions.outdir;
                if (outdir) {
                    await rm(outdir, {recursive: true})
                    console.log('Билд очищен')
                }
            } catch (e) {
                console.log('Не удалось очистить папку')
            }
        })
    }
}
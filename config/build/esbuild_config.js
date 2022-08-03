import ESbuild from 'esbuild'
import path from "path"
import fs from 'fs';
import { rm, copyFile } from 'fs/promises';
import { CleanPlugin } from "./plugins/CleanPlugin"
import { HtmlPlugin } from "./plugins/HtmlPlugin/index"
import copy from 'esbuild-plugin-copy-watch'

const viewsDir = path.resolve("./src/views")

const mode = process.env.MODE || 'development';
const isDev = mode === 'development';
const isProd = mode === 'production';

export const config = {
    format: "esm",
    target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
    outdir: path.resolve('build'),
    entryPoints: [path.resolve('src', 'index.js')],
    entryNames: '[dir]/bundle.[name]-[hash]',
    bundle: true,
    minify: isProd,
    sourcemap: isDev,
    metafile: true,
    incremental: true,
    loader: {
        ".png": 'file',
        ".svg": 'file',
        ".html": "file",
        ".svgz": 'file',
        ".jpg": 'file',
        //fonts
        ".woff": 'file',
        ".woff2": 'file',
        ".ttf": 'file',
        ".ttf2": 'file',
        ".eot": 'file',
    },
    plugins: [
        /*CleanPlugin,*/
        HtmlPlugin({
            indexHtml: './src/views/index.html',
        }),
    ]
}

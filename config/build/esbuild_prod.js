import ESbuild from 'esbuild'
import path from "path"
import {config} from "./esbuild_config.js"

ESbuild.build(config)
.catch(console.log)

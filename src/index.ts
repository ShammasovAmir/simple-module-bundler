import fs from "fs"
import path from "path"
import babel from "@babel/core"
import traverse from "@babel/core"
import { transformFromAst } from "@babel/core"

function createAsset(filename: string) {
  const content = fs.readFileSync(filename, "utf-8")

  const ast = babel.parse(content, {
    sourceType: "module",
  })

  const dependencies = []

  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value)
    },
  })

  const id = ID++

  const { code } = transformFromAst(ast, null, {
    presets: ["env"],
  })

  return {
    id,
    filename,
    dependencies,
    code,
  }
}

function createGraph(entry) {
  const mainAsset = createAsset(entry)

  const queue = [mainAsset]

  for (const asset of queue) {
    asset.mapping = {}

    const dirname = path.dirname(asset.filename)

    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath)

      const child = createAsset(absolutePath)

      asset.mapping[relativePath] = child.id

      queue.push(child)
    })
  }

  return queue
}

function createBundle(graph) {
  let modules = ""

  graph.forEach((m) => {
    modules += `${m.id}: [
      function (require, module, exports) {
        ${m.code}
      },
      ${JSON.stringify(m.mapping)}
    ],`
  })

  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id]

        function localRequire(name) {
          return require(mapping[name])
        }

        const module = { exports: {} }

        fn(localRequire, module, module.exports)

        return module.exports
      }

      require(0)
    })({ ${modules} })
  `

  return result
}

function pack() {
  const PATH_TO_CONFIG = path.join(__dirname, "bundler.config.json")
  if (!fs.pathExistsSync(PATH_TO_CONFIG)) throw new Error("Config is required.")

  const config = fs.readJSONSync(PATH_TO_CONFIG)

  if (
    !config.entryPoint ||
    typeof config.entryPoint !== "string" ||
    !config.entryPoint.trim()
  )
    throw new Error("Entrypoint is required.")

  if (
    !config.outDir ||
    typeof config.outDir !== "string" ||
    !config.outDir.trim()
  )
    throw new Error("Outdir is required.")

  const graph = createGraph(path.join(__dirname, config.entryPoint))
  const result = createBundle(graph)

  const PATH_TO_BUILD = path.join(__dirname, config.outDir)
  if (fs.pathExistsSync(PATH_TO_BUILD)) fs.removeSync(PATH_TO_BUILD)

  fs.mkdirpSync(PATH_TO_BUILD)
  fs.writeFileSync(`${PATH_TO_BUILD}/index.js`, code, "utf-8")

  console.log("Bundle created.")
}

pack()

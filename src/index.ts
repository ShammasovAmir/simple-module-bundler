import babel from "@babel/core"

class ModuleGraph {
  constructor(input) {
    this.path = input
    this.content = fs.readFileSync(input, "utf-8")
    this.ast = babel.parseSync(this.content)
    // store the dependencies of the current module
    this.dependencies = this.getDependencies()
  }

  getDependencies() {
    return (
      this.ast.program.body
        // get import statements
        .filter((node) => node.type === "ImportDeclaration")
        .map((node) => node.source.value)
        // resolve the path of the imports
        .map((currentPath) => resolveRequest(this.path, currentPath))
        // create module graph class for the resolved dependencies
        .map((absolutePath) => createModuleGraph(absolutePath))
    )
  }
}

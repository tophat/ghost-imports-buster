import chalk from 'chalk'

import {
    diffDependenciesLists,
    discoverSourceFiles,
    extractDeclaredDependencies,
    getImportsFromFiles,
} from './useCases'
import parseCliArgs from './cli'

function validateDependencies(projectPath: string): void {
    const declaredDependencies = extractDeclaredDependencies(projectPath)
    const sourceFiles = discoverSourceFiles(projectPath)
    const importedDependencies = getImportsFromFiles(sourceFiles)

    const { left: unused, right: undeclared } = diffDependenciesLists(
        declaredDependencies,
        importedDependencies,
    )

    if (unused.length === 0)
        console.log(chalk.greenBright`🎉No unused dependencies! 🎉`)
    else {
        console.log(
            chalk.yellowBright(
                `The following dependencies are declared in ${projectPath}/package.json but are not imported anywhere:`,
            ),
        )
        unused.forEach((dep: string) => {
            console.log(`👀 ${dep}`)
        })
    }

    if (undeclared.length === 0)
        console.log(chalk.greenBright`✨No undeclared dependencies!✨`)
    else {
        console.log(
            chalk.yellowBright(
                `The following dependencies are imported but not declared in ${projectPath}`,
            ),
        )
        undeclared.forEach((dep: string) => {
            console.log(`👻 ${dep}`)
        })
    }
}

const cliArgs = process.argv
const runParams = parseCliArgs(cliArgs)
validateDependencies(runParams[0])

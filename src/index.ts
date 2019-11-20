import { readFileSync } from 'fs'

import chalk from 'chalk'

import {
    discoverSourceFiles,
    gatherPackageConfigDependencies,
    getImportsFromFiles,
    getUndeclaredDependencies,
    getUnusedDependencies,
} from './useCases'
import parseCliArgs from './cli'

const validateDependencies = (
    packageConfigPath = './package.json',
    sourcePaths: string[],
): void => {
    const packageConfigRaw = readFileSync(packageConfigPath, {
        encoding: 'utf-8',
    })
    const packageConfig = JSON.parse(packageConfigRaw)
    const expectedDependencies = gatherPackageConfigDependencies(packageConfig)
    const sourceFiles = sourcePaths.reduce(
        (sourceList: string[], source: string): string[] => {
            return [...sourceList, ...discoverSourceFiles(source)]
        },
        [],
    )
    const importedDependencies = getImportsFromFiles(sourceFiles)

    const allDependencies = Object.values(
        expectedDependencies,
    ).reduce((acc: string[], current: string[]): string[] => [
        ...acc,
        ...current,
    ])
    const unused = getUnusedDependencies(
        expectedDependencies.dependencies,
        importedDependencies,
    )
    const undeclared = getUndeclaredDependencies(
        allDependencies,
        importedDependencies,
    )

    if (unused.length === 0)
        console.log(chalk.greenBright`No unused dependencies!`)
    else {
        console.log(
            chalk.yellowBright(
                `The following dependencies are declared in ${packageConfigPath} but are not imported anywhere in ${sourcePaths}:`,
            ),
        )
        unused.forEach((dep: string) => {
            console.log(dep)
        })
    }

    if (undeclared.length === 0)
        console.log(chalk.greenBright`No undeclared dependencies!`)
    else {
        console.log(
            chalk.yellowBright(
                `The following dependencies are imported but not declared in ${packageConfigPath}`,
            ),
        )
        undeclared.forEach((dep: string) => {
            console.log(dep)
        })
    }
}

const cliArgs = process.argv
const runParams = parseCliArgs(cliArgs)
const packagePath = './package.json'
validateDependencies(packagePath, runParams)

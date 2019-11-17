import { lstatSync, readFileSync, readdirSync } from 'fs'

import { parse } from '@babel/parser'
import traverse from '@babel/traverse'

import { PackageConfig, PackageDependencies } from './types.d'

export const gatherPackageConfigDependencies = (
    packageConfig: PackageConfig,
): PackageDependencies => {
    const {
        dependencies = {},
        devDependencies = {},
        peerDependencies = {},
    } = packageConfig

    return {
        dependencies: Object.keys(dependencies),
        devDependencies: Object.keys(devDependencies),
        peerDependencies: Object.keys(peerDependencies),
    }
}

export const discoverSourceFiles = (sourcePath: string): string[] => {
    const currentEntity = lstatSync(sourcePath)
    if (currentEntity.isFile()) return [sourcePath]

    const currentContent = readdirSync(sourcePath)
    return currentContent.reduce((acc: string[], current: string): string[] => {
        const stat = lstatSync(`${sourcePath}/${current}`)
        if (stat.isDirectory()) {
            return [...acc, ...discoverSourceFiles(`${sourcePath}/${current}`)]
        } else {
            return [...acc, `${sourcePath}/${current}`]
        }
    }, [])
}

export const getImportsFromFile = (path: string): string[] => {
    const sourceCode: string = readFileSync(path, { encoding: 'utf-8' })
    const ast = parse(sourceCode, { sourceType: 'module' })
    const dependencies: string[] = []

    traverse(ast, {
        ImportDeclaration(path) {
            dependencies.push(path?.node?.source?.value)
        },
    })

    return dependencies
}

export const getImportsFromFiles = (paths: string[]): string[] =>
    paths.reduce(
        (acc: string[], current: string): string[] => [
            ...acc,
            ...getImportsFromFile(current),
        ],
        [],
    )

export const getDependenciesDiff = (
    first: string[],
    second: string[],
    filter: Function = (): boolean => true,
): string[] => {
    const reduceHandler = (diff: string[], current: string): string[] => {
        const isDiff = !second.includes(current) && filter(current)
        return isDiff ? [...diff, current] : diff
    }

    return first.reduce(reduceHandler, [])
}

export const getUnusedDependencies = (
    dependencies: string[],
    imported: string[],
): string[] => getDependenciesDiff(dependencies, imported)

export const isBuiltIn = (packageName: string): boolean => {
    try {
        return !require.resolve(packageName).includes('node_modules')
    } catch (e) {
        console.log(e)
        return false
    }
}

export const getUndeclaredDependencies = (
    dependencies: string[],
    imported: string[],
): string[] => getDependenciesDiff(imported, dependencies, isBuiltIn)

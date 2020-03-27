import { lstatSync, readFileSync, readdirSync } from 'fs'

import { DiffReport, PackageDependencies } from './types.d'
import { ES6_IMPORT_STATEMENT, REQUIRE_IMPORT_STATEMENT } from './constants'
import { isValidSourceFile } from './helpers'

export function extractDeclaredDependencies(
    packagePath = '.',
): PackageDependencies {
    try {
        const packageFile = readFileSync(`${packagePath}/package.json`, {
            encoding: 'utf-8',
        })
        const parsedPackageFile = JSON.parse(packageFile)
        return {
            dependencies: Object.keys(parsedPackageFile.dependencies || {}),
            peerDependencies: Object.keys(
                parsedPackageFile.peerDependencies || {},
            ),
        }
    } catch (e) {
        return { dependencies: [], peerDependencies: [] }
    }
}

export function discoverSourceFiles(sourcePath: string): string[] {
    const currentEntity = lstatSync(sourcePath)
    if (currentEntity.isFile()) return [sourcePath]

    const currentContent = readdirSync(sourcePath)
    return currentContent.reduce((acc: string[], current: string): string[] => {
        const path = `${sourcePath}/${current}`

        if (path.includes('node_modules')) return acc

        const stat = lstatSync(path)
        if (stat.isDirectory()) {
            return [...acc, ...discoverSourceFiles(path)]
        } else if (isValidSourceFile(current)) {
            return [...acc, path]
        }

        return acc
    }, [])
}

export function getImportsFromFile(path: string): string[] {
    const fileSource = readFileSync(path, { encoding: 'utf-8' })
    const importPatterns = [ES6_IMPORT_STATEMENT, REQUIRE_IMPORT_STATEMENT]
    const imported: string[] = []

    importPatterns.forEach((pattern: RegExp): void => {
        let currentMatch = pattern.exec(fileSource)

        while (currentMatch) {
            imported.push(currentMatch[1])
            currentMatch = pattern.exec(fileSource)
        }
    })

    return imported
}

export function getImportsFromFiles(paths: string[]): string[] {
    return paths.reduce(
        (acc: string[], current: string): string[] => [
            ...acc,
            ...getImportsFromFile(current),
        ],
        [],
    )
}

export function diffDependenciesLists(
    leftSet: string[],
    rightSet: string[],
    filter: Function = (): boolean => true,
): DiffReport {
    const unionSet = new Set([...leftSet, ...rightSet])
    const reduceHandler = function(
        report: DiffReport,
        current: string,
    ): DiffReport {
        if (!filter(current)) return report

        const inLeft = leftSet.includes(current)
        const inRight = rightSet.includes(current)

        if (inLeft && !inRight) report.left.push(current)
        if (inRight && !inLeft) report.right.push(current)
        if (inRight && inLeft) report.union.push(current)

        return report
    }

    const reportBase = { left: [], right: [], union: [] }
    const { left, right, union } = Array.from(unionSet).reduce(
        reduceHandler,
        reportBase,
    )

    return {
        left,
        right,
        union,
    }
}

import path from 'path'

import chalk from 'chalk'

import { Report, UndeclaredDependencyMap } from './types'

export default function printReport(report: Report): void {
    const cwd = process.cwd()

    for (const workspaceName of report.workspaces) {
        const unused = report.unusedDependencies.get(workspaceName)
        const undeclared: UndeclaredDependencyMap =
            report.undeclaredDependencies.get(workspaceName) ?? new Map()

        console.log('')
        console.log(`📦 ${workspaceName}`)

        if (unused && unused.size > 0) {
            console.log(
                chalk.yellow(
                    '  Unused dependencies (declared but not imported anywhere)',
                ),
            )
            unused.forEach((dependency) => {
                console.log(`   ↳ ${dependency}`)
            })
        } else {
            console.log(chalk.green('  No unused dependencies!'))
        }

        const sets = {
            dependencies: new Map<string, string | undefined>(),
            devDependencies: new Map<string, string | undefined>(),
            peerDependencies: new Map<string, string | undefined>(),
        }
        for (const [dependency, targetSet] of undeclared.entries()) {
            sets[targetSet.dependencyType].set(
                dependency,
                targetSet.importedFrom
                    ? path.relative(cwd, targetSet.importedFrom)
                    : undefined,
            )
        }

        for (const [setType, dependencySet] of Object.entries(sets)) {
            if (!dependencySet.size) {
                console.log(chalk.green(`  No undeclared ${setType}!`))
            } else {
                console.log(
                    chalk.red(
                        `  Undeclared ${setType} (imported but not declared in package.json):`,
                    ),
                )
                for (const [
                    dependency,
                    importedFrom,
                ] of dependencySet.entries()) {
                    console.log(
                        `   ↳ ${dependency}: ${chalk.dim(importedFrom ?? '?')}`,
                    )
                }
            }
        }
    }
}

import chalk from 'chalk'

import { Report } from './types'

export default function printReport(report: Report): void {
    for (const workspaceName of report.workspaces) {
        const unused = report.unusedDependencies.get(workspaceName)
        const undeclared = report.undeclaredDependencies.get(workspaceName)

        console.log(`📦 ${workspaceName}`)

        if (unused && unused.size > 0) {
            console.log(
                chalk.yellow(
                    'Unused dependencies (declared but not imported anywhere)',
                ),
            )
            unused.forEach((dependency) => {
                console.log(`→ ${dependency}`)
            })
        } else {
            console.log(chalk.green('No unused dependencies!'))
        }
        if (undeclared && undeclared.size > 0) {
            console.log(
                chalk.red(
                    'Undeclared dependencies (imported but not declared in package.json)',
                ),
            )
            undeclared.forEach((dependency) => {
                console.log(`→ ${dependency}`)
            })
        } else {
            console.log(chalk.green('No undeclared dependencies!'))
        }
    }
}

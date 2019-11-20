import program from 'commander'

const parseCliArgs = (args: string[]): string[] => {
    let pathsToProcess: string[] = []

    program
        .command('validate <target> [otherTargets...]')
        .option('-e', '--throwOnFail', 'Throws an error on failure.')
        .action((target: string, otherTargets: string[]) => {
            pathsToProcess = otherTargets ? [target, ...otherTargets] : [target]
        })

    program.parse(args)

    return pathsToProcess
}

export default parseCliArgs

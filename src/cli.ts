#!/usr/bin/env node

import yargs from 'yargs'

import validateDependencies from '.'

const argv = yargs(process.argv.slice(2))
    .usage('ghostimports [projectRootPath]')
    .option('cwd', {
        type: 'string',
        description: 'Project root',
    })
    .option('include', {
        type: 'array',
        description: 'Paths to include in the analysis',
    })
    .option('exclude', {
        type: 'array',
        description: 'Paths to exclude from the analysis',
    })
    .option('fix', {
        type: 'boolean',
        description: 'Attempt to fix package.json based on analysis',
    }).argv

validateDependencies({
    cwd: argv.cwd,
    include: argv.include as string[],
    exclude: argv.exclude as string[],
    fix: argv.fix,
}).catch((e) => {
    console.log(e)
    process.exit(1)
})

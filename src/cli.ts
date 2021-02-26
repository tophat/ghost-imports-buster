#!/usr/bin/env node

import yargs from 'yargs'

import validateDependencies from '.'

const argv = yargs(process.argv.slice(2)).usage(
    'ghostimports [projectRootPath]',
).argv

validateDependencies({ cwd: argv._[0] as string }).catch(() => process.exit(1))

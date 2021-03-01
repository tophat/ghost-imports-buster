import { promises as fs } from 'fs'
import { resolve } from 'path'

import { AnalysisConfiguration } from './types'

export default async function maybeGetConfigurationFromFile(
    cwd: string,
): Promise<AnalysisConfiguration | void> {
    try {
        const configurationFromFile = await fs.readFile(
            resolve(cwd, '.ghostImports.json'),
            { encoding: 'utf8' },
        )
        const parsedConfiguration = JSON.parse(configurationFromFile)

        return parsedConfiguration
    } catch (e) {
        /* Configuration unavailable */
    }
}

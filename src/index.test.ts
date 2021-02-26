import { resolve } from 'path'

import validateDependencies from '.'

describe('', () => {
    const cwd = process.cwd()

    it('with no missing dependencies', async () => {
        const projectPath = resolve(cwd, 'example-repos/no-missing-deps')
        const report = await validateDependencies({ cwd: projectPath })

        expect(report.undeclaredDependencies.size).toEqual(1)
        expect(
            report.undeclaredDependencies.get('no-missing-deps').size,
        ).toEqual(0)
        expect(report.unusedDependencies.size).toEqual(1)
        expect(report.unusedDependencies.get('no-missing-deps').size).toEqual(0)
    })

    it('with missing dependencies', async () => {
        const projectPath = resolve(cwd, 'example-repos/missing-deps')
        const report = await validateDependencies({ cwd: projectPath })
        expect(report.undeclaredDependencies.size).toEqual(1)
        expect(report.undeclaredDependencies.get('missing-deps').size).toEqual(
            1,
        )
        expect(report.unusedDependencies.size).toEqual(1)
        expect(report.unusedDependencies.get('missing-deps').size).toEqual(0)
    })
})

import validateDependencies from '../src'

import { createFile, readFile, withDirectoryContext } from './testUtils'

describe('autofixing', () => {
    it('resolves versions correct from node_modules if available', async () => {
        await withDirectoryContext(
            {
                'pkg-1': {},
            },
            async (projectRoot: string) => {
                const undeclaredPackageJson = {
                    version: '1.2.3',
                    name: 'pkg-2',
                }
                await createFile(
                    projectRoot,
                    'node_modules/pkg-2/package.json',
                    JSON.stringify(undeclaredPackageJson),
                )

                await createFile(
                    `${projectRoot}/pkg-1/`,
                    'index.js',
                    `
                         import { foo } from "pkg-2"

                         foo()`,
                )

                await validateDependencies({
                    cwd: `${projectRoot}/pkg-1`,
                    fix: true,
                })
                const manifest = await readFile(
                    `${projectRoot}/pkg-1/package.json`,
                )
                const parsedManifest = JSON.parse(manifest)

                expect(parsedManifest.dependencies).toEqual({
                    [undeclaredPackageJson.name]: `^${undeclaredPackageJson.version}`,
                })
            },
        )
    })
})

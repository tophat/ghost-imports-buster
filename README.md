# Ghost Imports Buster
###### :ghost: I ain't afraid of no ghost

---

## Motivation

Because of [how NodeJS import resolution functions](https://nodejs.org/api/modules.html#modules_all_together), it is possible for packages that are not part of your project's `package.json` to the resolved by `import` and `require` statements in your code. This obviously isn't ideal because these "ghost dependencies" operate outside of the contract between your project's dependencies and whatever system installs and runs it.

Having these ghostly imports can cause a whole lot of issues, ranging from cases of "it works on my machine!" to static analysis tools failing to detect circular imports between groups of packages (if your project is a monorepo). Of course, best practices dictate that anything imported that isn't a core package should be listed in `package.json`, but sometimes best practices are overlooked and messes happen. This is where `ghost-imports-buster` comes in.

`ghost-imports-buster` compiles a list of your peer, development and production dependencies (based on `package.json`) and then traverses your package's source code to get an equivalent list of anything that is imported. It then diffs those two lists (with some exclusions, because relative/absolute file imports and core packages don't need policing) to verify that any third-party library that is used in your application code is accounted for in the package configuration.

## Installation

_Coming soon._

## Usage

_Coming Soon._

## Contributing


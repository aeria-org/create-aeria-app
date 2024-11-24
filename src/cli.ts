import path from 'path'
import { parseArgs, promisify } from 'util'
import semver from 'semver'
import fs from 'fs'
import readline from 'readline'
import {
  type Tuple,
  error,
  success,
  isError,
  unwrap,
  $,
  LogLevel,
  log,
} from './util.js'
import { TEMPLATES } from './templates.js'
import { printBanner } from './banner.js'

const {
  positionals,
  values: opts,
} = parseArgs({
  allowPositionals: true,
  options: {
    bare: {
      type: 'boolean',
      short: 'b',
    },
    stable: {
      type: 'boolean',
      short: 's',
    },
    force: {
      type: 'boolean',
      short: 'f',
    },
    template: {
      type: 'string',
      short: 't',
    },
  },
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = promisify(rl.question).bind(rl)

const allChecksPass = async (checks: Promise<Tuple>[]) => {
  for( const check of checks ) {
    const result = await check
    log(isError(result)
      ? LogLevel.Error
      : LogLevel.Info, unwrap(result))

    if( isError(result) ) {
      return
    }
  }

  return true
}

const checkPackageVersion = async () => {
  if( opts.force ) {
    return success('skipping version check as -f option was passed')
  }

  const {
    name: packageName,
    version: packageVersion,
  } = require('../package.json')

  const remoteVersion = await $(`npm view ${packageName} version`)

  if( packageVersion !== remoteVersion ) {
    return error([
      'local and remote versions of this package differ',
      `rerun using the '@latest' specifier (npm create -y aeria-app@latest ${positionals[0] || 'my-app'})`,
      'alternativelly, rerun this command with the -f option (npm create aeria-app package-name -- -f)',
    ])
  }

  return success('package is up-to-date')
}

const checkCompatibility = async () => {
  const localNodeVersion = await $('node -v')
  const remoteNodeVersion = await $('npm view aeria engine.node')

  if( !semver.satisfies(localNodeVersion, remoteNodeVersion) ) {
    return error('local node version is outdated')
  }

  return success('node version is compatible')
}

const main = async () => {
  printBanner()

  const { template = 'app-ts' } = opts

  const checksOk = await allChecksPass([
    checkPackageVersion(),
    checkCompatibility(),
  ])

  if( !checksOk ) {
    return
  }

  if( !(template in TEMPLATES) ) {
    log(LogLevel.Error, `invalid template, available ones are: ${Object.keys(TEMPLATES)}`)
    return
  }

  const projectName = positionals[0]
    ? positionals[0]
    : await question('what\'s the project name? ')

  if( !projectName ) {
    log(LogLevel.Error, 'project name can not be empty')
    return
  }

  const cwd = process.cwd()
  const projectPath = path.join(cwd, projectName)

  if( fs.existsSync(projectPath) ) {
    log(LogLevel.Error, `path '${projectPath}' already exists`)
    return
  }

  await $(`git clone --depth=1 --branch=master ${TEMPLATES[template]} ${projectPath}`)
  await fs.promises.rm(path.join(projectPath, '.git'), {
    recursive: true,
  })

  await fs.promises.copyFile(
    path.join(projectPath, 'api', 'sample.env'),
    path.join(projectPath, 'api', '.env'),
  )

  if( !opts.stable ) {
    log(LogLevel.Info, 'removing create-aeria-app.lock')
    await fs.promises.unlink(path.join(projectPath, 'create-aeria-app.lock'))
  }

  if( !opts.bare ) {
    log(LogLevel.Info, 'installing dependencies')
    await $([
      `cd ${projectPath.replace(/\\/g, '/')}`,
      'npm i',
    ])
  }

  log(LogLevel.Info, `your project '${projectName}' was created, make good use of it`)
  log(LogLevel.Info, 'to serve your project, cd into it and run: npm run dev')
}

const wrapper = async () => {
  await main()
  rl.close()
}

wrapper()


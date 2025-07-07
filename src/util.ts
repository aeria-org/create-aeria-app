import { spawn } from 'node:child_process'

export type Tuple =
  | [string | string[]]
  | [undefined, string | string[]]

export const error = (value: string | string[]): Tuple => [value]
export const success = (value: string | string[]): Tuple => [,value]
export const isError = (tuple: Tuple) => !!tuple[0]
export const unwrap = (tuple: Tuple) => tuple[0] || tuple[1]

export const $ = async (
  cmd: string | string[],
  options: {
    stdout?: boolean
    stderr?: boolean
  } = {},
) => {
  const result = spawn('sh', [
    '-c',
    Array.isArray(cmd)
      ? cmd.join(';')
      : cmd,
  ])

  if( options.stdout ) {
    result.stdout.pipe(process.stdout)
  }

  if (options.stderr !== false) {
    result.stderr.pipe(process.stderr)
  }

  const stdout: string[] = []
  for await( const chunk of result.stdout ) {
    stdout.push(chunk.toString())
  }

  return stdout.join('\n').trim()
}

export const LogLevel = {
  Info: 'info',
  Error: 'error',
  Warning: 'warning',
  Debug: 'debug',
} as const

export const log = (level: typeof LogLevel[keyof typeof LogLevel], value: any) => {
  console.log(
    `[${level}]`,
    Array.isArray(value)
      ? value.join('\n')
      : value,
  )
}


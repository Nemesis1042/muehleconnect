import { tmpdir } from 'os'

export const app = {
  getPath: () => tmpdir()
}

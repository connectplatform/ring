// Lightweight stub for bert-js used only for build/analyzer purposes.
// Not suitable for production protocol use. Replace with real implementation when available.
const bert = {
  encode: (obj) => {
    try {
      const json = JSON.stringify(obj)
      return Buffer.from(json)
    } catch {
      return Buffer.from([])
    }
  },
  decode: (buf) => {
    try {
      const json = Buffer.from(buf).toString()
      return JSON.parse(json)
    } catch {
      return {}
    }
  },
}
module.exports = bert



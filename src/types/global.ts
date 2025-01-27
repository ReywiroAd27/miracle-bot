declare global {
  namespace NodeJS {
    interface Process {
      hitTotal: number;
    }
  }
  interface Console {
    input: Function;
  }
}
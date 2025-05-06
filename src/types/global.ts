type List = {
  id: string;
  value: string;
}

declare global {
  namespace NodeJS {
    interface Process {
      hitTotal: number;
    }
  }
  interface Console {
    input: ((question: string)=>Promise<string>);
    select: ((question: string, list: List[], handler?: Function)=>Promise<string|number|boolean|Buffer|RegExp|void>);
    checkbox: ((question: string, list: List[], conf?: Function|{min: number,max: number,}))
  }
}
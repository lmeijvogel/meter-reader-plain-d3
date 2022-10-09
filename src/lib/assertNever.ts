export function assertNever(n: never): never {
    throw new Error(`Unexpected value: ${n}`);
}

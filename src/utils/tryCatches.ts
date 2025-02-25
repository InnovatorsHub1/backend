export const tryCatch = (fn: Function) => {
    const result: { data: unknown, error: unknown } = { data: null, error: null }
    try {
        result.data = fn();
    } catch (error) {
        result.error = error;
    }
    return result;
}

export const tryCatchAsync = async <T>(fn: Function): Promise<{ data: T, error: unknown }> => {
    const result: { data: unknown, error: unknown } = { data: null, error: null }
    try {
        result.data = await fn();
    } catch (error) {
        result.error = error;
    }
    return result as { data: T, error: unknown };
}
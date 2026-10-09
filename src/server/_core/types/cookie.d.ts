declare module "cookie" {
  export function parse(
    str: string,
    options?: Record<string, unknown>
  ): Record<string, string>;
  export function serialize(
    name: string,
    value: string,
    options?: {
      domain?: string;
      encode?: (value: string) => string;
      expires?: Date;
      httpOnly?: boolean;
      maxAge?: number;
      path?: string;
      sameSite?: boolean | "lax" | "strict" | "none";
      secure?: boolean;
    }
  ): string;
}

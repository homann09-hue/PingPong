export interface Authenticator {
  authenticate(authorization: string | undefined): Promise<string | null>;
}

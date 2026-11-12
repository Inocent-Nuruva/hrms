/** Serializes draft saves and keeps the latest edit revision pending. */
export class ContractSaveQueue<T> {
  private revision = 0;
  private completedRevision = 0;
  private inFlight: Promise<boolean> | null = null;
  private conflict = false;
  constructor(
    private updatedAt: string,
    private readonly snapshot: () => T,
    private readonly write: (
      value: T,
      updatedAt: string,
    ) => Promise<{ updatedAt: string }>,
    private readonly wait: (milliseconds: number) => Promise<void> = (
      milliseconds,
    ) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}
  changed() {
    this.revision += 1;
  }
  get dirty() {
    return this.completedRevision < this.revision;
  }
  get conflicted() {
    return this.conflict;
  }
  /** Resume after the caller has fetched and presented the latest server version. */
  rebase(updatedAt: string) {
    if (this.inFlight) throw new Error("Cannot rebase an active save");
    this.updatedAt = updatedAt;
    this.conflict = false;
  }
  async flush(): Promise<boolean> {
    if (this.conflict) return false;
    if (this.inFlight) return this.inFlight;
    if (!this.dirty) return true;
    this.inFlight = (async () => {
      try {
        while (this.completedRevision < this.revision) {
          const revision = this.revision;
          const value = this.snapshot();
          let attempt = 0;
          let result: { updatedAt: string };
          for (;;) {
            try {
              result = await this.write(value, this.updatedAt);
              break;
            } catch (error) {
              const status = (error as { status?: number }).status;
              if (
                status === 409 ||
                (status !== undefined && status < 500) ||
                attempt >= 2
              )
                throw error;
              await this.wait(500 * 2 ** attempt++);
            }
          }
          this.updatedAt = result.updatedAt;
          this.completedRevision = revision;
        }
        return true;
      } catch (error) {
        if ((error as { status?: number }).status === 409) this.conflict = true;
        throw error;
      }
    })();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }
}

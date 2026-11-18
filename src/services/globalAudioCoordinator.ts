export type AudioOwnerId = 'mushaf' | 'library' | 'session' | 'ruqyah' | string;

type StopAudioCallback = () => void;

class GlobalAudioCoordinator {
  private owners = new Map<AudioOwnerId, StopAudioCallback>();
  private activeOwner: AudioOwnerId | null = null;

  register(ownerId: AudioOwnerId, onStop: StopAudioCallback): () => void {
    this.owners.set(ownerId, onStop);
    return () => {
      if (this.owners.get(ownerId) === onStop) {
        this.owners.delete(ownerId);
      }
      if (this.activeOwner === ownerId) {
        this.activeOwner = null;
      }
    };
  }

  claimFocus(ownerId: AudioOwnerId): void {
    for (const [id, stop] of this.owners.entries()) {
      if (id !== ownerId) {
        try {
          stop();
        } catch {
          // Best-effort stop across views
        }
      }
    }
    this.activeOwner = ownerId;
  }

  releaseFocus(ownerId: AudioOwnerId): void {
    if (this.activeOwner === ownerId) {
      this.activeOwner = null;
    }
  }

  stopAll(): void {
    for (const stop of this.owners.values()) {
      try {
        stop();
      } catch {
        // Best-effort stop across views
      }
    }
    this.activeOwner = null;
  }

  getActiveOwner(): AudioOwnerId | null {
    return this.activeOwner;
  }
}

export const globalAudioCoordinator = new GlobalAudioCoordinator();

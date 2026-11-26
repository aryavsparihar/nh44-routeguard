import { describe, expect, it } from "vitest";
import { pickVoice, speechText, type VoiceLike } from "./speech";

const voice = (lang: string, localService = true, name = lang): VoiceLike => ({ lang, localService, name });

describe("pickVoice", () => {
  it("takes Indian English first, then any English voice", () => {
    expect(pickVoice([voice("en-US"), voice("en-IN")], "en")?.lang).toBe("en-IN");
    expect(pickVoice([voice("en-GB")], "en")?.lang).toBe("en-GB");
  });

  it("takes a Hindi voice for Hindi and an Urdu voice (India or Pakistan) for Urdu", () => {
    expect(pickVoice([voice("en-IN"), voice("hi-IN")], "hi")?.lang).toBe("hi-IN");
    expect(pickVoice([voice("ur-PK")], "ur")?.lang).toBe("ur-PK");
    expect(pickVoice([voice("ur_IN")], "ur")?.lang).toBe("ur_IN"); // Android writes an underscore
  });

  it("never reads Hindi or Urdu with an English voice: no match means no button", () => {
    const englishOnly = [voice("en-IN"), voice("en-US")];
    expect(pickVoice(englishOnly, "hi")).toBeNull();
    expect(pickVoice(englishOnly, "ur")).toBeNull();
    expect(pickVoice([voice("hi-IN")], "ur")).toBeNull();
    expect(pickVoice([], "en")).toBeNull();
  });

  it("prefers a voice on the phone, which also works offline", () => {
    const picked = pickVoice([voice("hi-IN", false, "online"), voice("hi-IN", true, "on phone")], "hi");
    expect(picked?.name).toBe("on phone");
  });

  it("doesn't take a look-alike language tag", () => {
    expect(pickVoice([voice("eng")], "en")).toBeNull();
  });
});

describe("speechText", () => {
  it("reads the lines on screen in order, including the advisory line", () => {
    const text = speechText(["Hold and check again", "Zone 4 is medium in 12 h.", null, "Advice only, not a road status."]);
    expect(text).toBe("Hold and check again Zone 4 is medium in 12 h. Advice only, not a road status.");
  });

  it("leaves out empty lines", () => {
    expect(speechText(["", "  ", undefined, "Send now"])).toBe("Send now");
  });
});

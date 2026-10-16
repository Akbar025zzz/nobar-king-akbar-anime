import { describe, expect, it } from "vitest";
import {
  contentId,
  parseContentId,
  parseEpisodeNumber,
  parseScore,
  parseStatus,
  qualityScore,
  rankStreamCandidates,
  sourceFromContentId,
  streamTypeFromUrl,
  toAnimeDetail,
  toCardFromCompleted,
  toCardFromOngoing,
  toCardFromSearch,
  toGenreList,
  toStreamSource,
} from "../src/adapters/wajik/wajik.adapter";
import type {
  OtakudesuAnimeDetails,
  OtakudesuEpisodeDetails,
  OtakudesuOngoingAnime,
  OtakudesuSearchAnime,
} from "../src/adapters/wajik/wajik.types";

/* Fixtures taken from live responses of the vendored wajik-anime-api. */

const ongoingFixture: OtakudesuOngoingAnime = {
  title: "Tokyo Revengers Season 4",
  poster: "https://otakudesu.blog/wp-content/uploads/2026/10/TokRev-S4.jpg",
  episodes: 3,
  releaseDay: "Kamis",
  latestReleaseDate: "16 Okt",
  animeId: "tokyo-revs-sanhen-sub-indo",
  href: "/otakudesu/anime/tokyo-revs-sanhen-sub-indo/",
  otakudesuUrl: "https://otakudesu.blog/anime/tokyo-revs-sanhen-sub-indo/",
};

const searchFixture: OtakudesuSearchAnime = {
  title: "One Piece Subtitle Indonesia",
  animeId: "1piece-sub-indo",
  poster: "https://otakudesu.blog/wp-content/uploads/2021/05/One-Piece-Sub-Indo.jpg",
  score: "Rating : 8.54",
  status: "Status : Ongoing",
  otakudesuUrl: "https://otakudesu.blog/anime/1piece-sub-indo/",
};

const detailFixture: OtakudesuAnimeDetails = {
  title: "Tokyo Revengers Season 4",
  japanese: "東京リベンジャーズ",
  score: "",
  type: "TV",
  status: "Ongoing",
  episodes: null,
  poster: "https://otakudesu.blog/wp-content/uploads/2026/10/TokRev-S4.jpg",
  synopsis: "Takemichi kembali ke masa lalu...",
  genreList: [
    { title: "Action", genreId: "action", otakudesuUrl: "https://otakudesu.blog/genres/action/" },
    { title: "Drama", genreId: "drama", otakudesuUrl: "https://otakudesu.blog/genres/drama/" },
  ],
  episodeList: [
    {
      title: "3",
      episodeId: "tkrvgs-s4-episode-3-sub-indo",
      otakudesuUrl: "https://otakudesu.blog/episode/tkrvgs-s4-episode-3-sub-indo/",
    },
    {
      title: "2",
      episodeId: "tkrvgs-s4-episode-2-sub-indo",
      otakudesuUrl: "https://otakudesu.blog/episode/tkrvgs-s4-episode-2-sub-indo/",
    },
    {
      title: "1",
      episodeId: "tkrvgs-s4-episode-1-sub-indo",
      otakudesuUrl: "https://otakudesu.blog/episode/tkrvgs-s4-episode-1-sub-indo/",
    },
  ],
};

const episodeFixture: OtakudesuEpisodeDetails = {
  title: "Tokyo Revengers Season 4 Episode 3",
  animeId: "tokyo-revs-sanhen-sub-indo",
  defaultStreamingUrl:
    "https://desustream.net/dstream/odcdn/?id=TXdXSlhBdGVKMGNnWkQyZHF4NWR0cW11ZXZaSEZsNVlNbWNza25zV0pXWCt3aFd3dUxWZHZsQVREZDJUTk5EYw==",
  server: {
    qualityList: [
      {
        title: " Mirror 360p",
        serverList: [
          { title: "vidhide", serverId: "eyJpZCI6MjA2NjczLCJpIjowfQ==" },
          { title: "mega", serverId: "eyJpZCI6MjA2NjczLCJpIjoxfQ==" },
        ],
      },
      {
        title: " Mirror 480p",
        serverList: [
          { title: "odcdn", serverId: "eyJpZCI6MjA2NjczLCJxIjoiNDgwcCJ9" },
          { title: "vidhide", serverId: "eyJpZCI6MjA2NjczLCJpIjoxfQ==" },
        ],
      },
      {
        title: " Mirror 720p",
        serverList: [
          { title: "odstream", serverId: "eyJpZCI6MjA2NjczLCJxIjoiNzIwcCJ9" },
          { title: "ondesuhd", serverId: "eyJpZCI6MjA2NjczLCJxIjoiaGQifQ==" },
          { title: "vidhide", serverId: "eyJpZCI6MjA2NjczLCJpIjozfQ==" },
        ],
      },
    ],
  },
};

describe("content ids", () => {
  it("namespaces ids per source", () => {
    expect(contentId("otakudesu", "tokyo-revs-sanhen-sub-indo")).toBe(
      "otakudesu:tokyo-revs-sanhen-sub-indo"
    );
  });

  it("parses namespaced ids", () => {
    expect(parseContentId("otakudesu:1piece-sub-indo")).toEqual({
      source: "otakudesu",
      animeId: "1piece-sub-indo",
    });
    expect(parseContentId("oploverz:one-piece-heroines")).toEqual({
      source: "oploverz",
      animeId: "one-piece-heroines",
    });
  });

  it("rejects unknown or malformed ids", () => {
    expect(parseContentId("naruto")).toBeNull();
    expect(parseContentId("anime1v:naruto")).toBeNull();
    expect(parseContentId("otakudesu:")).toBeNull();
  });

  it("falls back to otakudesu for legacy rows", () => {
    expect(sourceFromContentId("otakudesu:x")).toBe("otakudesu");
    expect(sourceFromContentId("legacy-slug")).toBe("otakudesu");
  });
});

describe("value parsing", () => {
  it("parses scores from labelled and plain strings", () => {
    expect(parseScore("Rating : 8.54")).toBe(8.54);
    expect(parseScore("6.88")).toBe(6.88);
    expect(parseScore("")).toBeNull();
    expect(parseScore(null)).toBeNull();
  });

  it("strips the status label", () => {
    expect(parseStatus("Status : Ongoing")).toBe("Ongoing");
    expect(parseStatus("Completed")).toBe("Completed");
    expect(parseStatus(null)).toBeNull();
  });

  it("parses episode numbers from titles and ids", () => {
    expect(parseEpisodeNumber("3", "tkrvgs-s4-episode-3-sub-indo")).toBe(3);
    expect(parseEpisodeNumber(null, "tkrvgs-s4-episode-12-sub-indo")).toBe(12);
    expect(parseEpisodeNumber("Episode 07", "x-episode-7-sub-indo")).toBe(7);
    expect(parseEpisodeNumber(null, "no-number-here")).toBeNull();
  });
});

describe("card normalization", () => {
  it("maps ongoing entries", () => {
    const card = toCardFromOngoing(ongoingFixture);
    expect(card.id).toBe("otakudesu:tokyo-revs-sanhen-sub-indo");
    expect(card.source).toBe("otakudesu");
    expect(card.status).toBe("Ongoing");
    expect(card.posterUrl).toContain("TokRev-S4.jpg");
  });

  it("maps completed entries with a numeric score", () => {
    const card = toCardFromCompleted({
      title: "Saijo no Osewa",
      poster: null,
      episodes: "12",
      animeId: "saijo-osewa-sub-indo",
      score: "6.88",
      lastReleaseDate: "14 Okt",
      otakudesuUrl: "https://otakudesu.blog/anime/saijo-osewa-sub-indo/",
    });
    expect(card.status).toBe("Completed");
    expect(card.score).toBe(6.88);
  });

  it("maps search entries", () => {
    const card = toCardFromSearch(searchFixture);
    expect(card.id).toBe("otakudesu:1piece-sub-indo");
    expect(card.status).toBe("Ongoing");
    expect(card.score).toBe(8.54);
  });

  it("builds details with episodes and genres", () => {
    const detail = toAnimeDetail(detailFixture, "tokyo-revs-sanhen-sub-indo");
    expect(detail.id).toBe("otakudesu:tokyo-revs-sanhen-sub-indo");
    expect(detail.genres).toEqual(["Action", "Drama"]);
    expect(detail.episodes).toHaveLength(3);
    expect(detail.episodes[0]).toEqual({
      id: "tkrvgs-s4-episode-3-sub-indo",
      number: 3,
      title: "3",
      url: "https://otakudesu.blog/episode/tkrvgs-s4-episode-3-sub-indo/",
    });
    expect(detail.totalEpisodes).toBe(3);
  });

  it("maps genre lists", () => {
    expect(
      toGenreList([
        { title: "Action", genreId: "action", otakudesuUrl: "https://otakudesu.blog/genres/action/" },
        { title: "", genreId: "", otakudesuUrl: "" },
      ])
    ).toEqual([{ name: "Action", slug: "action" }]);
  });
});

describe("stream candidates", () => {
  it("ranks higher quality first, then preferred servers", () => {
    const ranked = rankStreamCandidates(episodeFixture);
    // Most reliable server first (odcdn = otakudesu's own CDN), then quality.
    expect(ranked[0]).toMatchObject({ server: "odcdn", qualityScore: 480 });
    expect(ranked[1]).toMatchObject({ server: "odstream", qualityScore: 720 });
    expect(ranked[2]).toMatchObject({ server: "ondesuhd", qualityScore: 720 });
    expect(ranked[3]).toMatchObject({ server: "vidhide", qualityScore: 720 });
    expect(ranked.map((candidate) => candidate.qualityScore)).toEqual([480, 720, 720, 720, 480, 360, 360]);
  });

  it("computes quality scores", () => {
    expect(qualityScore(" Mirror 720p")).toBe(720);
    expect(qualityScore("Mirror 1080p")).toBe(1080);
    expect(qualityScore("auto")).toBe(0);
  });

  it("detects stream types", () => {
    expect(streamTypeFromUrl("https://cdn.odcloud.net/anime/x.mp4")).toBe("mp4");
    expect(
      streamTypeFromUrl("https://rr3---sn-x.googlevideo.com/videoplayback?id=1&source=blogger")
    ).toBe("mp4");
    expect(streamTypeFromUrl("https://cdn.example.com/live/master.m3u8?token=1")).toBe("hls");
    expect(streamTypeFromUrl("https://example.com/embed/abc")).toBe("embed");
  });

  it("builds stream sources with labels", () => {
    const source = toStreamSource({
      url: "https://cdn.odcloud.net/anime/Otakudesu.io_TokRev.S4--03_720p.mp4",
      server: "odcdn",
      label: "720p · odcdn",
    });
    expect(source.type).toBe("mp4");
    expect(source.server).toBe("odcdn");
    expect(source.label).toBe("720p · odcdn");
    expect(source.proxyUrl).toBeNull();
  });
});

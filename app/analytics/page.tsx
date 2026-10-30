import { getAuthMember } from "@/lib/auth";
import { canExport } from "@/lib/rbac";
import { computeAnalytics } from "@/lib/analytics";
import { PLATFORM_NAMES } from "@/lib/channels";
import type { MemberRole } from "@/lib/db";
import AnalyticsControls from "@/components/AnalyticsControls";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const me = await getAuthMember();
  if (!me) {
    return (
      <div className="card">
        <strong>Not signed in.</strong>
        <p className="muted">Run the app with DEMO_MODE=1 to use the demo workspace.</p>
      </div>
    );
  }

  const data = await computeAnalytics(me.workspaceId);
  const t = data.totals;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="sub">Engagement across your connected channels. Engagement rate = engagements ÷ impressions.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="stat-num">{t.posts}</span><span className="stat-label">Published posts</span></div>
        <div className="stat"><span className="stat-num">{t.impressions.toLocaleString()}</span><span className="stat-label">Impressions</span></div>
        <div className="stat"><span className="stat-num">{t.avgImpressions.toLocaleString()}</span><span className="stat-label">Avg impressions / post</span></div>
        <div className="stat"><span className="stat-num">{(t.likes + t.comments + t.shares).toLocaleString()}</span><span className="stat-label">Likes, comments, shares</span></div>
        <div className="stat"><span className="stat-num">{t.clicks.toLocaleString()}</span><span className="stat-label">Link clicks</span></div>
      </div>

      <AnalyticsControls canExport={canExport(me.role as MemberRole)} sponsored={data.sponsoredVsOrganic.sponsored} organic={data.sponsoredVsOrganic.organic} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Channel</th><th>Followers</th><th>Posts</th><th>Impressions</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Clicks</th><th>Engagement</th></tr>
          </thead>
          <tbody>
            {data.perChannel.map((c) => (
              <tr key={c.channelId}>
                <td>{PLATFORM_NAMES[c.platform]}</td>
                <td>{c.followers.toLocaleString()}</td>
                <td>{c.posts}</td>
                <td>{c.impressions.toLocaleString()}</td>
                <td>{c.likes}</td>
                <td>{c.comments}</td>
                <td>{c.shares}</td>
                <td>{c.clicks}</td>
                <td>{c.engagementRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.topPost && (
        <>
          <h2>Top post</h2>
          <div className="card" style={{ maxWidth: 640 }}>{data.topPost.text}</div>
        </>
      )}
    </>
  );
}

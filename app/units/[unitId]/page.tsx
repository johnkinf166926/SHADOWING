import { notFound } from "next/navigation";
import { UnitTrackList } from "@/components/study/unit-track-list";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Progress } from "@/components/ui/progress";
import { getCourseUnitSummary } from "@/lib/server/course-content";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const unit = await getCourseUnitSummary(unitId);
  if (!unit) {
    notFound();
  }
  const trackCount = unit.sections.reduce(
    (total, section) => total + section.tracks.length,
    0,
  );

  return (
    <div className="page-stack">
      <Breadcrumbs
        items={[
          { label: "课程", href: "/units" },
          { label: `Unit ${unit.number}` },
        ]}
      />
      <header className="unit-detail-header">
        <span className="unit-detail-number">{unit.number}</span>
        <div>
          <p className="eyebrow">UNIT {unit.number}</p>
          <h1>{unit.title}</h1>
          <p className="unit-subtitle">{unit.subtitle}</p>
          <p className="muted">{unit.description}</p>
        </div>
        <div className="unit-detail-progress">
          <strong>{unit.progress}%</strong>
          <span>完成</span>
          <Progress value={unit.progress} label="Unit 完成度" />
        </div>
      </header>

      <section className="surface">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">SECTIONS & TRACKS</p>
            <h2>课程结构</h2>
          </div>
          <Badge tone="neutral">{trackCount} 个 Track</Badge>
        </div>
        <UnitTrackList sections={unit.sections} />
      </section>
    </div>
  );
}

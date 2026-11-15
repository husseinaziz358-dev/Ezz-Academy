import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { SimulationKind } from '../data/academyData';

interface InteractiveConceptLabProps {
  kind: SimulationKind;
}

export function InteractiveConceptLab({ kind }: InteractiveConceptLabProps) {
  if (kind === 'neural-convergence') {
    return <NeuralConvergenceLab />;
  }
  if (kind === 'web-architecture') {
    return <WebArchitectureLab />;
  }
  return <MathCalculusLab />;
}

function MathCalculusLab() {
  const [a, setA] = useState<number>(1);
  const [b, setB] = useState<number>(-2);
  const [c, setC] = useState<number>(-1);
  const [x0, setX0] = useState<number>(2);

  const analysis = useMemo(() => {
    const f = (x: number) => a * x * x + b * x + c;
    const fPrime = (x: number) => 2 * a * x + b;

    const y0 = f(x0);
    const slope = fPrime(x0);
    const normalSlope = Math.abs(slope) > 0.05 ? -1 / slope : null;
    const vertexX = Math.abs(a) > 0.05 ? -b / (2 * a) : 0;
    const vertexY = f(vertexX);

    const toSvgX = (x: number) => 180 + x * 32;
    const toSvgY = (y: number) => 100 - y * 16;

    const curvePts: string[] = [];
    for (let x = -5; x <= 5; x += 0.25) {
      const sx = toSvgX(x);
      const sy = toSvgY(f(x));
      if (sy >= -40 && sy <= 240) {
        curvePts.push(`${curvePts.length === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`);
      }
    }

    const tX1 = x0 - 2.5;
    const tY1 = y0 + slope * (tX1 - x0);
    const tX2 = x0 + 2.5;
    const tY2 = y0 + slope * (tX2 - x0);

    const statusLabel =
      Math.abs(slope) < 0.05
        ? 'نقطة حرجة — المماس أفقي (المشتقة = ٠)'
        : slope > 0
          ? 'الدالة متزايدة عند هذه النقطة (المشتقة > ٠)'
          : 'الدالة متناقصة عند هذه النقطة (المشتقة < ٠)';

    return {
      y0,
      slope,
      normalSlope,
      vertexX,
      vertexY,
      curvePath: curvePts.join(' '),
      pointSvg: { x: toSvgX(x0), y: toSvgY(y0) },
      tangentSvg: {
        x1: toSvgX(tX1),
        y1: toSvgY(tY1),
        x2: toSvgX(tX2),
        y2: toSvgY(tY2),
      },
      statusLabel,
      isStationary: Math.abs(slope) < 0.05,
    };
  }, [a, b, c, x0]);

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-6 border border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
        <div>
          <h4 className="text-base font-semibold text-white">
            مختبر التفاضل والمنحنيات — ميل المماس والنقط الحرجة
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            حرّك نقطة التماس س₀ أو معاملات الدالة التربيعية لملاحظة تغيّر المشتقة الأولى وميل المماس لحظيًا.
          </p>
        </div>

        <div
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border ${
            analysis.isStationary
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
              : 'bg-blue-950/60 border-blue-700/50 text-blue-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{analysis.statusLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-slate-950 rounded-lg border border-slate-800 p-4 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300 mb-2 tabular-nums">
            <span dir="ltr">
              f(x) = {a}x² {b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`}x {c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`}
            </span>
            <span className="text-sky-400" dir="ltr">
              f&apos;({x0}) = {analysis.slope.toFixed(2)}
            </span>
          </div>

          <svg
            viewBox="0 0 360 200"
            className="w-full h-52 bg-slate-950 rounded"
            role="img"
            aria-label="شبكة إحداثية لمنحنى الدالة ومماسها"
          >
            <line x1="180" y1="8" x2="180" y2="192" stroke="#334155" strokeWidth="1" />
            <line x1="12" y1="100" x2="348" y2="100" stroke="#334155" strokeWidth="1" />
            <line x1="12" y1="52" x2="348" y2="52" stroke="#1E293B" strokeDasharray="3 3" />
            <line x1="12" y1="148" x2="348" y2="148" stroke="#1E293B" strokeDasharray="3 3" />

            <path
              d={analysis.curvePath}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            <line
              x1={analysis.tangentSvg.x1}
              y1={analysis.tangentSvg.y1}
              x2={analysis.tangentSvg.x2}
              y2={analysis.tangentSvg.y2}
              stroke="#F59E0B"
              strokeWidth="2"
              strokeDasharray="5 3"
            />

            <circle
              cx={analysis.pointSvg.x}
              cy={analysis.pointSvg.y}
              r="5"
              fill="#F59E0B"
              stroke="#0F172A"
              strokeWidth="2"
            />
          </svg>

          <div className="grid grid-cols-3 gap-3 pt-3 mt-2 border-t border-slate-800 text-xs tabular-nums">
            <div>
              <div className="text-slate-400">نقطة التماس</div>
              <div className="font-mono text-white mt-0.5" dir="ltr">
                ({x0.toFixed(1)}, {analysis.y0.toFixed(1)})
              </div>
            </div>
            <div>
              <div className="text-slate-400">ميل العمودي</div>
              <div className="font-mono text-white mt-0.5" dir="ltr">
                {analysis.normalSlope !== null ? analysis.normalSlope.toFixed(2) : 'غير معرف'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">رأس المنحنى</div>
              <div className="font-mono text-white mt-0.5" dir="ltr">
                ({analysis.vertexX.toFixed(1)}, {analysis.vertexY.toFixed(1)})
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-950/60 rounded-lg border border-slate-800 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="x0-slider" className="text-slate-300 font-medium">
                  موضع نقطة التماس (س₀)
                </label>
                <span className="font-mono text-amber-400 tabular-nums">{x0.toFixed(1)}</span>
              </div>
              <input
                id="x0-slider"
                type="range"
                min={-3.5}
                max={3.5}
                step={0.5}
                value={x0}
                onChange={(e) => setX0(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="a-slider" className="text-slate-300 font-medium">
                  معامل س² (أ)
                </label>
                <span className="font-mono text-sky-400 tabular-nums">{a.toFixed(1)}</span>
              </div>
              <input
                id="a-slider"
                type="range"
                min={-2}
                max={2}
                step={0.5}
                value={a}
                onChange={(e) => setA(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="b-slider" className="text-slate-300 font-medium">
                  معامل س (ب)
                </label>
                <span className="font-mono text-sky-400 tabular-nums">{b.toFixed(1)}</span>
              </div>
              <input
                id="b-slider"
                type="range"
                min={-4}
                max={4}
                step={1}
                value={b}
                onChange={(e) => setB(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="c-slider" className="text-slate-300 font-medium">
                  الحد المطلق (جـ)
                </label>
                <span className="font-mono text-sky-400 tabular-nums">{c.toFixed(1)}</span>
              </div>
              <input
                id="c-slider"
                type="range"
                min={-3}
                max={3}
                step={1}
                value={c}
                onChange={(e) => setC(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setA(1);
              setB(-2);
              setC(-1);
              setX0(2);
            }}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط المنحنى</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function NeuralConvergenceLab() {
  const [learningRate, setLearningRate] = useState<number>(0.15);
  const [regularization, setRegularization] = useState<number>(0.2);

  const curveData = useMemo(() => {
    const epochs = 14;
    const trainPoints: { x: number; y: number }[] = [];
    const valPoints: { x: number; y: number }[] = [];

    for (let i = 0; i <= epochs; i++) {
      const t = i / epochs;
      let trainLoss: number;
      let valLoss: number;

      if (learningRate > 0.65) {
        const oscillation = Math.sin(i * 1.9) * (learningRate - 0.5) * 0.45;
        trainLoss = Math.min(0.95, Math.max(0.25, 0.72 - t * 0.18 + oscillation));
        valLoss = Math.min(0.98, Math.max(0.32, 0.78 - t * 0.1 + oscillation * 1.2));
      } else {
        const speed = 1.4 + learningRate * 4.2;
        trainLoss = 0.85 * Math.exp(-speed * t) + 0.08;
        const overfitPenalty = regularization < 0.15 ? Math.max(0, t - 0.45) * 0.38 : 0.03;
        valLoss = 0.88 * Math.exp(-speed * 0.85 * t) + 0.11 + overfitPenalty;
      }

      trainPoints.push({ x: (i / epochs) * 320 + 20, y: 160 - (1 - trainLoss) * 130 });
      valPoints.push({ x: (i / epochs) * 320 + 20, y: 160 - (1 - valLoss) * 130 });
    }

    const status =
      learningRate > 0.65
        ? { label: 'تذبذب — معدل التعلم مرتفع جدًا', ok: false }
        : regularization < 0.15
          ? { label: 'فرط تخصيص — ارفع معامل التنظيم', ok: false }
          : learningRate < 0.06
            ? { label: 'تقارب بطيء — زد معدل التعلم تدريجيًا', ok: false }
            : { label: 'تقارب مستقر ومثالي', ok: true };

    const toPath = (pts: { x: number; y: number }[]) =>
      pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    return {
      trainPath: toPath(trainPoints),
      valPath: toPath(valPoints),
      finalTrainLoss: (1 - (160 - trainPoints[trainPoints.length - 1].y) / 130).toFixed(2),
      finalValLoss: (1 - (160 - valPoints[valPoints.length - 1].y) / 130).toFixed(2),
      status,
    };
  }, [learningRate, regularization]);

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-6 border border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
        <div>
          <h4 className="text-base font-semibold text-white">
            مختبر تقارب دالة الخسارة (Gradient Descent)
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            عدّل معدل التعلم ومعامل التنظيم لمشاهدة منحنى خطأ التدريب والتحقق لحظيًا.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border ${
            curveData.status.ok
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
              : 'bg-amber-950/60 border-amber-700/50 text-amber-300'
          }`}
        >
          {curveData.status.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{curveData.status.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-slate-950 rounded-lg border border-slate-800 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-sky-400">
                <span className="w-3 h-0.5 bg-sky-400 inline-block" />
                خطأ التدريب
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-400">
                <span className="w-3 h-0.5 bg-amber-400 inline-block" />
                خطأ التحقق
              </span>
            </div>
            <span className="font-mono tabular-nums text-slate-300">
              Train: {curveData.finalTrainLoss} · Val: {curveData.finalValLoss}
            </span>
          </div>

          <svg viewBox="0 0 360 180" className="w-full h-48" role="img" aria-label="منحنى دالة الخسارة">
            <line x1="20" y1="20" x2="20" y2="160" stroke="#334155" strokeWidth="1" />
            <line x1="20" y1="160" x2="345" y2="160" stroke="#334155" strokeWidth="1" />
            <path d={curveData.trainPath} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
            <path d={curveData.valPath} fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeDasharray="5 3" strokeLinecap="round" />
          </svg>
        </div>

        <div className="lg:col-span-5 bg-slate-950/60 rounded-lg border border-slate-800 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <label htmlFor="lr-slider" className="text-slate-300 font-medium">
                  معدل التعلم (Learning Rate α)
                </label>
                <span className="font-mono text-blue-400 tabular-nums">{learningRate.toFixed(2)}</span>
              </div>
              <input
                id="lr-slider"
                type="range"
                min={0.02}
                max={0.9}
                step={0.02}
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-2">
                <label htmlFor="reg-slider" className="text-slate-300 font-medium">
                  معامل التنظيم (L2 / Dropout)
                </label>
                <span className="font-mono text-blue-400 tabular-nums">{regularization.toFixed(2)}</span>
              </div>
              <input
                id="reg-slider"
                type="range"
                min={0}
                max={0.5}
                step={0.05}
                value={regularization}
                onChange={(e) => setRegularization(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setLearningRate(0.15);
              setRegularization(0.2);
            }}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة المعاملات المتوازنة</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function WebArchitectureLab() {
  const [columns, setColumns] = useState<number>(3);
  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-6 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-white">مختبر الشبكة المتجاوبة</h4>
        <input
          type="range"
          min={1}
          max={4}
          value={columns}
          onChange={(e) => setColumns(Number(e.target.value))}
          className="accent-blue-500"
        />
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <div key={i} className="p-3 rounded bg-slate-950 border border-slate-800 text-xs font-mono">
            Node_0{i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

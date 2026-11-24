import React, { useState } from 'react';
import type { ToolId } from '../../types';
import { SpeakButton } from '../../contexts/SpeechContext';

const num = (val: string, fallback = 0): number => {
  const normalized = (val || '').trim().replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const MaterialCalculators: React.FC<{ toolId: ToolId }> = ({ toolId }) => {
  // Cement
  const [cArea, setCArea] = useState('25');
  const [cThick, setCThick] = useState('10');
  const [cType, setCType] = useState<'slab' | 'mortar' | 'plaster'>('slab');

  // Cement Formula 1.54
  const [fLen, setFLen] = useState('5');
  const [fWid, setFWid] = useState('4');
  const [fHeight, setFHeight] = useState('0.15');
  const [fGrade, setFGrade] = useState<'b20' | 'b25' | 'b15' | 'mortar'>('b20');

  // Concrete
  const [coLen, setCoLen] = useState('5');
  const [coWid, setCoWid] = useState('4');
  const [coThick, setCoThick] = useState('0.15');
  const [coCount, setCoCount] = useState('1');

  // Brick
  const [bLen, setBLen] = useState('6');
  const [bHeight, setBHeight] = useState('3');
  const [bOpen, setBOpen] = useState('2');
  const [bType, setBType] = useState<'6' | '8' | '12'>('8');

  // Paint
  const [pArea, setPArea] = useState('80');
  const [pCoats, setPCoats] = useState('2');
  const [pCov, setPCov] = useState('8');

  // Tile
  const [tLen, setTLen] = useState('5');
  const [tWid, setTWid] = useState('4');
  const [tSize, setTSize] = useState('60');
  const [tWaste, setTWaste] = useState('10');

  // Rebar
  const [rDiam, setRDiam] = useState('12');
  const [rLen, setRLen] = useState('6');
  const [rCount, setRCount] = useState('20');

  if (toolId === 'cement-formula') {
    const wetVol = num(fLen) * num(fWid) * num(fHeight);
    const dryVol = wetVol * 1.54;
    const grades = {
      b20: { c: 1, s: 2, g: 4, wc: 0.5, label: 'B20 (1 : 2 : 4) للضالة والسوميلات' },
      b25: { c: 1, s: 1.5, g: 3, wc: 0.45, label: 'B25 (1 : 1.5 : 3) للسواري والكمرات' },
      b15: { c: 1, s: 3, g: 6, wc: 0.55, label: 'B15 (1 : 3 : 6) بيطون بروبرطي' },
      mortar: { c: 1, s: 4, g: 0, wc: 0.5, label: 'مونة البني والمرطوب (1 : 4)' },
    };
    const cfg = grades[fGrade];
    const totalParts = cfg.c + cfg.s + cfg.g;
    const cementVol = (dryVol * cfg.c) / totalParts;
    const cementKg = cementVol * 1440;
    const cementBags = Math.ceil(cementKg / 50);
    const sandM3 = +((dryVol * cfg.s) / totalParts).toFixed(2);
    const gravelM3 = +((dryVol * cfg.g) / totalParts).toFixed(2);
    const sandWheelbarrows = Math.ceil((sandM3 * 1000) / 60);
    const gravelWheelbarrows = Math.ceil((gravelM3 * 1000) / 60);
    const waterLiters = Math.round(cementKg * cfg.wc);

    const speech = `بالفورمول الهندسي الحقيقي للمقدار ${wetVol.toFixed(2)} متر مكعب، الحجم الناشف هو ${dryVol.toFixed(2)} متر مكعب. خاصك ${cementBags} خنشة ديال السيما، و ${sandWheelbarrows} برويطة ديال الرملة${gravelWheelbarrows > 0 ? ` و ${gravelWheelbarrows} برويطة ديال الكياس` : ''}، ومعاهم ${waterLiters} ليتر ديال الما.`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              حاسبة السيما بفورمول حقيقي (معامل 1.54)
            </h2>
            <p className="text-sm text-slate-400">
              حساب علمي دقيق بالضرب فمعامل التقلص 1.54، التحويل لوزن 1440 كغ/م³، وحساب البرويطة (60 لتر)
            </p>
          </div>
          <SpeakButton id="smart-formula-voice" variant="primary" label="سمع الحساب بالدارجة" text={speech} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">الطول (م)</span>
            <input
              type="number"
              step="0.1"
              value={fLen}
              onChange={(e) => setFLen(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">العرض (م)</span>
            <input
              type="number"
              step="0.1"
              value={fWid}
              onChange={(e) => setFWid(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">العلو / السمك (م)</span>
            <input
              type="number"
              step="0.05"
              value={fHeight}
              onChange={(e) => setFHeight(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">العيار (الفورمول)</span>
            <select
              value={fGrade}
              onChange={(e) => setFGrade(e.target.value as typeof fGrade)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-3 text-white text-xs font-bold"
            >
              <option value="b20">B20 (1:2:4) ضالة وسوميلات</option>
              <option value="b25">B25 (1:1.5:3) سواري وكمرات</option>
              <option value="b15">B15 (1:3:6) بيطون بروبرطي</option>
              <option value="mortar">مونة (1:4) بني ومرطوب</option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-[#ff7a1a]/30 bg-[#0a0f1e] p-4 text-xs text-slate-300 font-mono-nums">
          الفورمول: V_wet = {wetVol.toFixed(2)} m³ · V_dry = V_wet × 1.54 = {dryVol.toFixed(2)} m³ · {cfg.label}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs text-slate-400">السيما (50 كلغ)</p>
            <p className="text-2xl font-extrabold text-[#ff7a1a] font-mono-nums mt-1">{cementBags} خنشة</p>
            <p className="text-[11px] text-slate-400 font-mono-nums">{Math.round(cementKg)} كلغ</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الرملة</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{sandWheelbarrows} برويطة</p>
            <p className="text-[11px] text-slate-400 font-mono-nums">{sandM3} م³</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الكياس (كرافيط)</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{gravelWheelbarrows} برويطة</p>
            <p className="text-[11px] text-slate-400 font-mono-nums">{gravelM3} م³</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الماء النظيف</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{waterLiters} لتر</p>
            <p className="text-[11px] text-slate-400 font-mono-nums">W/C = {cfg.wc}</p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'cement') {
    const area = num(cArea);
    const vol = area * (num(cThick) / 100);
    const bags = Math.ceil(vol * (cType === 'slab' ? 7 : cType === 'mortar' ? 6 : 5));
    const sand = +(vol * (cType === 'slab' ? 0.5 : 1)).toFixed(2);
    const gravel = cType === 'slab' ? +(vol * 0.8).toFixed(2) : 0;
    const speech = `بالنسبة لمساحة ${area} متر مربع وسمك ${cThick} سنتيمتر، خاصك تقريباً ${bags} خنشة ديال السيما من فئة خمسين كيلوغرام، ومعاها ${sand} متر مكعب ديال الرملة${gravel > 0 ? ` و ${gravel} متر مكعب ديال الكياس` : ''}.`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">حساب السيما (الإسمنت)</h2>
            <p className="text-sm text-slate-400">حسب شحال خاصك من خنشة السيما 50 كلغ والرملة</p>
          </div>
          <SpeakButton id="calc-cement-voice" variant="primary" label="سمع النتيجة بالدارجة" text={speech} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">المساحة (م²)</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={cArea}
              onChange={(e) => setCArea(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums focus:border-[#ff7a1a] focus:outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">السمك (سنتيمتر)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={cThick}
              onChange={(e) => setCThick(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums focus:border-[#ff7a1a] focus:outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">نوع الاستعمال</span>
            <select
              value={cType}
              onChange={(e) => setCType(e.target.value as typeof cType)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white focus:border-[#ff7a1a] focus:outline-none"
            >
              <option value="slab">بيطون / ضالة (350 كغ/م³)</option>
              <option value="mortar">مونة البني / الفورمة (300 كغ/م³)</option>
              <option value="plaster">المرطوب (250 كغ/م³)</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs text-slate-400">الحجم الكلي</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{vol.toFixed(2)} م³</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">خناشي السيما (50 كلغ)</p>
            <p className="text-2xl font-extrabold text-[#ff7a1a] font-mono-nums mt-1">{bags} خنشة</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الرملة المطلوبة</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{sand} م³</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الكياس (كرافيط)</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{gravel} م³</p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'concrete') {
    const vol = num(coLen) * num(coWid) * num(coThick) * Math.max(1, num(coCount, 1));
    const bags = Math.ceil(vol * 7);
    const sand = +(vol * 0.45).toFixed(2);
    const gravel = +(vol * 0.82).toFixed(2);
    const water = Math.round(vol * 175);
    const speech = `الحجم الخرساني هو ${vol.toFixed(2)} متر مكعب. باش تخلط هاد البيطون مزيان، خاصك ${bags} خنشة ديال السيما، و ${sand} متر مكعب رملة، و ${gravel} متر مكعب ديال الكياس، وتقريباً ${water} ليتر ديال الما.`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">الحساب الخرساني (البيطون)</h2>
            <p className="text-sm text-slate-400">للسواري، السوميلات، الشيناج والضالة (عيار 350 كغ/م³)</p>
          </div>
          <SpeakButton id="calc-concrete-voice" variant="primary" label="سمع النتيجة بالدارجة" text={speech} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">الطول (متر)</span>
            <input
              type="number"
              step="0.1"
              value={coLen}
              onChange={(e) => setCoLen(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">العرض (متر)</span>
            <input
              type="number"
              step="0.1"
              value={coWid}
              onChange={(e) => setCoWid(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">العلو / السمك (متر)</span>
            <input
              type="number"
              step="0.05"
              value={coThick}
              onChange={(e) => setCoThick(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">العدد (مثلا عدد السواري)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={coCount}
              onChange={(e) => setCoCount(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs text-slate-400">حجم البيطون</p>
            <p className="text-xl font-extrabold text-[#ff7a1a] font-mono-nums mt-1">{vol.toFixed(2)} م³</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">السيما CPJ45</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{bags} خنشة</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الرملة</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{sand} م³</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الكياس</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{gravel} م³</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الماء</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{water} لتر</p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'brick') {
    const netArea = Math.max(0, num(bLen) * num(bHeight) - num(bOpen));
    const perSqm = bType === '6' ? 17 : bType === '8' ? 16.5 : 15.5;
    const rawBricks = Math.ceil(netArea * perSqm);
    const totalBricks = Math.ceil(rawBricks * 1.05);
    const cementBags = Math.ceil(netArea * (bType === '12' ? 0.25 : 0.16));
    const speech = `المساحة الصافية ديال الحيط هي ${netArea.toFixed(1)} متر مربع. خاصك تقريباً ${totalBricks} بريقة من نوع ${bType} تقابي بالزيادة ديال التهراس، ومعاها ${cementBags} خناشي ديال السيما باش تلصقها.`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">حساب البريك (الآجور)</h2>
            <p className="text-sm text-slate-400">احسب عدد البريقات والسيما مع حساب نسبة 5% للضيعان</p>
          </div>
          <SpeakButton id="calc-brick-voice" variant="primary" label="سمع النتيجة بالدارجة" text={speech} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">طول الحيط (م)</span>
            <input
              type="number"
              step="0.1"
              value={bLen}
              onChange={(e) => setBLen(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">العلو (م)</span>
            <input
              type="number"
              step="0.1"
              value={bHeight}
              onChange={(e) => setBHeight(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">الأبواب والشراجم (م²)</span>
            <input
              type="number"
              step="0.5"
              value={bOpen}
              onChange={(e) => setBOpen(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">نوع البريك</span>
            <select
              value={bType}
              onChange={(e) => setBType(e.target.value as typeof bType)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white"
            >
              <option value="6">بريك 6 تقابي (قواطع داخلية)</option>
              <option value="8">بريك 8 تقابي (متوسط)</option>
              <option value="12">بريك 12 تقبة (حيط مزدوج / واجهة)</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs text-slate-400">المساحة الصافية</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{netArea.toFixed(1)} م²</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">عدد البريقات (+5% احتياط)</p>
            <p className="text-2xl font-extrabold text-[#ff7a1a] font-mono-nums mt-1">{totalBricks} بريقة</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">السيما للتلصاق</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{cementBags} خنشة</p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'paint') {
    const area = num(pArea);
    const coats = Math.max(1, num(pCoats, 2));
    const cov = Math.max(1, num(pCov, 8));
    const liters = Math.ceil((area * coats) / cov);
    const buckets = Math.ceil(liters / 15);
    const fixateur = Math.ceil(area / 10);
    const speech = `للمساحة ${area} متر مربع على ${coats} كوش، خاصك تقريباً ${liters} لتر ديال الصباغة، يعني ${buckets} سطل كبير ديال عشرين كيلو، ومعاهم ${fixateur} لتر ديال الفيكساتور للبريباراسيون.`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">حساب الصباغة والفيكساتور</h2>
            <p className="text-sm text-slate-400">احسب الليترات والسطولة على حساب مساحة الحيوط والسقف</p>
          </div>
          <SpeakButton id="calc-paint-voice" variant="primary" label="سمع النتيجة بالدارجة" text={speech} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">مساحة الصباغة (م²)</span>
            <input
              type="number"
              value={pArea}
              onChange={(e) => setPArea(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">عدد الطبقات (الكوش)</span>
            <input
              type="number"
              min="1"
              max="4"
              value={pCoats}
              onChange={(e) => setPCoats(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">تغطية اللتر (م²/لتر)</span>
            <input
              type="number"
              value={pCov}
              onChange={(e) => setPCov(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs text-slate-400">الصباغة المطلوبة</p>
            <p className="text-2xl font-extrabold text-[#ff7a1a] font-mono-nums mt-1">{liters} لتر</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">عدد السطولة (20 كغ)</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{buckets} سطل</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الفيكساتور (البريمار)</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{fixateur} لتر</p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'tile') {
    const netArea = num(tLen) * num(tWid);
    const totalArea = netArea * (1 + num(tWaste) / 100);
    const tileSideM = num(tSize, 60) / 100;
    const tileArea = Math.max(0.01, tileSideM * tileSideM);
    const tilesCount = Math.ceil(totalArea / tileArea);
    const cartons = Math.ceil(totalArea / 1.44);
    const glueBags = Math.ceil(totalArea / 4);
    const speech = `المساحة مع الاحتياط هي ${totalArea.toFixed(1)} متر مربع. خاصك تقريباً ${tilesCount} زليجة من قياس ${tSize} على ${tSize} سنتيم، يعني تقريباً ${cartons} كرطونة، ومعاها ${glueBags} خناشي ديال الكولا.`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">حساب الزليج والكولا</h2>
            <p className="text-sm text-slate-400">احسب عدد الزليجات والكرطونات وخناشي الكولا</p>
          </div>
          <SpeakButton id="calc-tile-voice" variant="primary" label="سمع النتيجة بالدارجة" text={speech} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">الطول (م)</span>
            <input
              type="number"
              step="0.1"
              value={tLen}
              onChange={(e) => setTLen(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">العرض (م)</span>
            <input
              type="number"
              step="0.1"
              value={tWid}
              onChange={(e) => setTWid(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">قياس الزليجة</span>
            <select
              value={tSize}
              onChange={(e) => setTSize(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white"
            >
              <option value="30">30 × 30 سم</option>
              <option value="45">45 × 45 سم</option>
              <option value="60">60 × 60 سم</option>
              <option value="80">80 × 80 سم</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">احتياط التقطيع (%)</span>
            <input
              type="number"
              min="0"
              max="30"
              value={tWaste}
              onChange={(e) => setTWaste(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs text-slate-400">المساحة + الاحتياط</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{totalArea.toFixed(1)} م²</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">عدد الزليجات</p>
            <p className="text-2xl font-extrabold text-[#ff7a1a] font-mono-nums mt-1">{tilesCount} حبة</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">عدد الكرطونات (تقريبي)</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{cartons} كرطونة</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">الكولا (25 كلغ)</p>
            <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{glueBags} خنشة</p>
          </div>
        </div>
      </div>
    );
  }

  // rebar
  const d = num(rDiam, 12);
  const len = num(rLen, 6);
  const count = Math.max(1, num(rCount, 1));
  const kgPerMeter = (d * d) / 162;
  const totalLen = len * count;
  const totalKg = +(kgPerMeter * totalLen).toFixed(1);
  const bars12m = Math.ceil(totalLen / 12);
  const speech = `بالنسبة لحديد قطر ${d}، عندك طول إجمالي ديال ${totalLen.toFixed(1)} متر. الوزن الإجمالي هو ${totalKg} كيلوغرام، وغادي تحتاج تقريباً ${bars12m} بارة من فئة طناش متر.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white">حساب الحديد (التسليح)</h2>
          <p className="text-sm text-slate-400">احسب الوزن بالكيلو وعدد البارات ديال 12 متر حسب القطر</p>
        </div>
        <SpeakButton id="calc-rebar-voice" variant="primary" label="سمع النتيجة بالدارجة" text={speech} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-300">قطر الحديد (مم)</span>
          <select
            value={rDiam}
            onChange={(e) => setRDiam(e.target.value)}
            className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
          >
            {['6', '8', '10', '12', '14', '16', '20'].map((val) => (
              <option key={val} value={val}>
                Ø{val} ({((Number(val) * Number(val)) / 162).toFixed(3)} كغ/م)
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-300">طول كل بار (متر)</span>
          <input
            type="number"
            step="0.5"
            value={rLen}
            onChange={(e) => setRLen(e.target.value)}
            className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-300">عدد البارات</span>
          <input
            type="number"
            min="1"
            value={rCount}
            onChange={(e) => setRCount(e.target.value)}
            className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-white font-mono-nums"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/10 pt-5">
        <div>
          <p className="text-xs text-slate-400">مجموع الطول</p>
          <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{totalLen.toFixed(1)} م</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">الوزن بالكيلوغرام</p>
          <p className="text-2xl font-extrabold text-[#ff7a1a] font-mono-nums mt-1">{totalKg} كلغ</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">بارات فئة 12 متر</p>
          <p className="text-xl font-extrabold text-white font-mono-nums mt-1">{bars12m} بارة</p>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CircleNotch, DownloadSimple, Plus, Sparkle, X } from '@phosphor-icons/react';
import { api, ApiError } from './lib/api';
import type { Accessory, Category, Collection, User } from './types';

const categoryLabel: Record<Category, string> = {
  earrings: 'イヤリング', necklace: 'ネックレス', headpiece: 'ヘッドアクセサリー',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [bootError, setBootError] = useState('');

  const refreshUser = async () => {
    const next = await api<User>('/api/me');
    setUser(next);
    return next;
  };

  useEffect(() => {
    api<User>('/api/session/bootstrap', { method: 'POST' })
      .then(setUser)
      .catch((error) => setBootError(messageOf(error)));
  }, []);

  if (bootError) return <CenteredMessage title="蜃気楼に接続できません" body={bootError} />;
  if (!user) return <CenteredMessage title="市場への扉を開いています" body="匿名のMirageウォレットを準備中…" busy />;

  return (
    <div className="app-shell">
      <Header user={user} />
      {user.demoMode && <div className="demo-ribbon">DEMO MODE — OpenAIキーをWorkerへ設定するとAI生成に切り替わります</div>}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateShopPage />} />
        <Route path="/shops/:slug" element={<PublicShopPage user={user} refreshUser={refreshUser} />} />
        <Route path="/try-ons/:id" element={<TryOnResultPage />} />
        <Route path="*" element={<CenteredMessage title="404 — 霧の向こうです" body="この場所はまだ存在していません。" />} />
      </Routes>
      <Footer />
    </div>
  );
}

function Header({ user }: { user: User }) {
  return (
    <header className="site-header">
      <div className="brand-lockup">
        <Link className="brand" to="/"><span className="brand-mark"><Sparkle weight="fill" /></span><span>MIRAGE MARKET</span></Link>
        <div className="imaginary-declaration"><strong>Everything here is imaginary.</strong><span>すべて架空の商品です。実物の販売・決済・配送はありません。</span></div>
        <nav><Link to="/create">ショップをつくる</Link><span className="balance"><Sparkle weight="fill" /> {user.balance.toLocaleString()} <small>Mirage</small></span></nav>
      </div>
    </header>
  );
}

function HomePage() {
  return (
    <main>
      <section className="hero">
        <img className="hero-image" src="/assets/mirage-hero.png" alt="液体の夕焼けを閉じ込め、宝石が周囲を浮遊する月のアクセサリー" />
        <div className="hero-inner page-width">
          <p className="eyebrow">A SHOP BEYOND PHYSICS</p>
          <h1>Wear What<br />Cannot Exist.</h1>
          <p className="hero-copy">存在しないきらめきを、あなたのものに。</p>
          <div className="hero-actions"><Link className="button primary" to="/create"><Sparkle weight="fill" />わたしのショップをつくる</Link><a className="text-link" href="#collection">存在しない新着品を見る <ArrowDown /></a></div>
        </div>
      </section>
      <section id="collection" className="sample-section page-width">
        <div className="section-heading"><div><p className="section-number">NEW ARRIVALS FROM NOWHERE</p><h2>存在しない新着品</h2></div><p>物理世界では作れない、<br />今月のきらめき。</p></div>
        <div className="sample-grid">
          <SampleCard name="欠けた月の耳飾り" kind="ORBITAL EARRINGS" price={300} tag="重力から自由" image="/assets/orbital-earrings.png" />
          <SampleCard name="余白を泳ぐ首飾り" kind="LIQUID SUNSET NECKLACE" price={420} tag="記憶に反応" image="/assets/liquid-sunset-necklace.png" />
          <SampleCard name="明日を隠す光冠" kind="BLOOMING LIGHT TIARA" price={500} tag="影の中だけ存在" image="/assets/blooming-light-tiara.png" />
        </div>
      </section>
      <section className="how-it-works page-width" aria-label="ショップをつくる3ステップ">
        <article><strong>01</strong><Sparkle /><div><h3>世界観をえらぶ</h3><p>あなたの内側にある物語を教えてください。</p></div></article>
        <article><strong>02</strong><Sparkle /><div><h3>アクセサリーを見つける</h3><p>物理法則から少し外れた3つの品を生成します。</p></div></article>
        <article><strong>03</strong><Sparkle /><div><h3>あなたの世界に呼び出す</h3><p>Mirageで迎え、写真の中で身につけられます。</p></div></article>
      </section>
      <section className="cta page-width"><p className="section-number">YOUR WORLD, YOUR SHOP</p><h2>まだ名前のない世界を、<br />店にしよう。</h2><Link className="button light" to="/create">コレクションをつくる <ArrowRight /></Link></section>
    </main>
  );
}

function SampleCard(props: { name: string; kind: string; price: number; tag: string; image: string }) {
  return (
    <article className="sample-card">
      <div className="artifact"><img src={props.image} alt={props.name} /><span className="impossibility-tag">{props.tag}</span></div>
      <div className="card-meta"><p>{props.kind}</p><h3>{props.name}</h3><span>◇ {props.price} Mirage</span><small>実物価格：存在しません</small></div>
    </article>
  );
}

function CreateShopPage() {
  const [step, setStep] = useState<'form' | 'collection'>('form');
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError('');
    const form = new FormData(event.currentTarget);
    const tags = String(form.get('tags') ?? '').split(/[、,]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 3);
    try {
      const result = await api<Collection>('/api/shops/generate', {
        method: 'POST',
        body: JSON.stringify({
          shopName: form.get('shopName'), theme: form.get('theme'), moodTags: tags,
          categories: ['earrings', 'necklace', 'headpiece'],
        }),
      });
      setCollection(result); setStep('collection'); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (nextError) { setError(messageOf(nextError)); }
    finally { setLoading(false); }
  };

  const generateImages = async () => {
    if (!collection) return;
    setLoading(true); setError('');
    setCollection({ ...collection, accessories: collection.accessories.map((item) => ({ ...item, generationStatus: 'generating' })) });
    const results = await Promise.allSettled(collection.accessories.map((item) => api<{ imageUrl: string; generationStatus: 'completed' }>(`/api/accessories/${item.id}/image`, { method: 'POST' })));
    const accessories = collection.accessories.map((item, index) => results[index].status === 'fulfilled'
      ? { ...item, ...results[index].value }
      : { ...item, generationStatus: 'failed' as const });
    setCollection({ ...collection, accessories });
    if (results.some((result) => result.status === 'rejected')) setError('一部の商品画像を生成できませんでした。失敗した商品を再試行してください。');
    setLoading(false);
  };

  const retryImage = async (id: string) => {
    if (!collection) return;
    setCollection({ ...collection, accessories: collection.accessories.map((item) => item.id === id ? { ...item, generationStatus: 'generating' } : item) });
    try {
      const result = await api<{ imageUrl: string; generationStatus: 'completed' }>(`/api/accessories/${id}/image`, { method: 'POST' });
      setCollection((current) => current ? { ...current, accessories: current.accessories.map((item) => item.id === id ? { ...item, ...result } : item) } : current);
    } catch (nextError) {
      setError(messageOf(nextError));
      setCollection((current) => current ? { ...current, accessories: current.accessories.map((item) => item.id === id ? { ...item, generationStatus: 'failed' } : item) } : current);
    }
  };

  const publish = async () => {
    if (!collection) return;
    setLoading(true); setError('');
    try {
      const result = await api<{ shareSlug: string }>(`/api/shops/${collection.shop.id}/publish`, { method: 'POST' });
      navigate(`/shops/${result.shareSlug}`);
    } catch (nextError) { setError(messageOf(nextError)); setLoading(false); }
  };

  if (step === 'collection' && collection) {
    const allDone = collection.accessories.every((item) => item.generationStatus === 'completed');
    const untouched = collection.accessories.every((item) => item.generationStatus === 'pending');
    return (
      <main className="creator page-width narrow">
        <Progress current={allDone ? 3 : 2} />
        <p className="eyebrow">COLLECTION DRAFT</p><h1>{collection.shop.name}</h1><p className="lead">{collection.shop.description}</p>
        {collection.demoMode && <Notice>OpenAI APIの一時エラーまたはキー未設定のため、審査用の安定したサンプルコンセプトを表示しています。</Notice>}
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="generated-grid">
          {collection.accessories.map((item) => <GeneratedCard key={item.id} item={item} onRetry={() => retryImage(item.id)} />)}
        </div>
        <div className="sticky-actions">
          {untouched && <button className="button primary" disabled={loading} onClick={generateImages}>{loading ? '3つの蜃気楼を結晶化中…' : '商品画像を3点生成する'}</button>}
          {!untouched && !allDone && <p className="quiet">失敗したカードの「再試行」を押してください。</p>}
          {allDone && <button className="button primary" disabled={loading} onClick={publish}>{loading ? '公開準備中…' : 'ショップを公開する →'}</button>}
        </div>
      </main>
    );
  }

  return (
    <main className="creator page-width narrow">
      <Progress current={1} />
      <p className="eyebrow">CREATE YOUR MIRAGE</p><h1>世界観から、<em>店をひらく。</em></h1>
      <p className="lead">商品の形ではなく、まず世界のルールを教えてください。AIが3つの「現実に作れない品」を考えます。</p>
      <form className="creation-form" onSubmit={create}>
        <label><span>ショップ名 <b>2—30文字</b></span><input name="shopName" minLength={2} maxLength={30} defaultValue="月裏感情装具店" required /></label>
        <label><span>この店の世界観 <b>10—300文字</b></span><textarea name="theme" minLength={10} maxLength={300} defaultValue={'月の裏側で、失くした気持ちをアクセサリーに変えて売る店'} required /></label>
        <label><span>雰囲気タグ <b>最大3つ・読点区切り</b></span><input name="tags" defaultValue="幻想的、切ない、宇宙" /></label>
        <fieldset><legend>商品カテゴリ</legend><div className="category-row">{(['earrings', 'necklace', 'headpiece'] as Category[]).map((key) => <span key={key}><Check weight="bold" /> {categoryLabel[key]}</span>)}</div></fieldset>
        {error && <ErrorBox>{error}</ErrorBox>}
        <button className="button primary full" disabled={loading}>{loading ? <><CircleNotch className="spin" />世界の奥から商品を探しています…</> : <>コレクションをつくる <ArrowUpRight /></>}</button>
      </form>
    </main>
  );
}

function GeneratedCard({ item, onRetry }: { item: Accessory; onRetry: () => void }) {
  return (
    <article className="generated-card">
      <div className="generated-image">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <div className={`placeholder ${item.generationStatus}`}><span>{item.generationStatus === 'generating' ? '◌' : '✦'}</span><small>{statusLabel(item.generationStatus)}</small></div>}
      </div>
      <div className="generated-content"><p className="category">{categoryLabel[item.category]}</p><span className="impossibility-tag inline">{impossibilityTag(item.category)}</span><h2>{item.name}</h2><p>{item.shortDescription}</p><blockquote>{item.lore}</blockquote><p className="impossible"><span>IMPOSSIBLE FEATURE</span>{item.impossibleFeature}</p><div className="price">◇ {item.price} Mirage<small>実物価格：存在しません</small></div>{item.generationStatus === 'failed' && <button className="small-button" onClick={onRetry}>画像生成を再試行</button>}</div>
    </article>
  );
}

function PublicShopPage({ user, refreshUser }: { user: User; refreshUser: () => Promise<User> }) {
  const { slug } = useParams();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [selected, setSelected] = useState<Accessory | null>(null);
  const [purchased, setPurchased] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Collection>(`/api/public/shops/${slug}`).then(setCollection).catch((next) => setError(messageOf(next)));
    api<{ purchases: Array<{ accessoryId: string }> }>('/api/purchases').then((data) => setPurchased(data.purchases.map((item) => item.accessoryId))).catch(() => undefined);
  }, [slug]);

  const buy = async (item: Accessory) => {
    setError('');
    try {
      await api('/api/purchases', { method: 'POST', body: JSON.stringify({ accessoryId: item.id }) });
      setPurchased((current) => [...current, item.id]); await refreshUser();
    } catch (nextError) { setError(messageOf(nextError)); }
  };

  if (error && !collection) return <CenteredMessage title="ショップを開けません" body={error} />;
  if (!collection) return <CenteredMessage title="蜃気楼を結んでいます" body="ショップの品々を並べています…" busy />;
  return (
    <main className="public-shop page-width">
      <section className="shop-hero"><p className="eyebrow">A SHOP BEYOND PHYSICS</p><h1>{collection.shop.name}</h1><p>{collection.shop.description}</p><div className="shop-facts"><span>{collection.shop.moodTags.join(' / ')}</span><span>{collection.shop.salesCount ?? 0} MIRAGES COLLECTED</span></div></section>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="shop-grid">{collection.accessories.map((item) => (
        <article className="shop-card" key={item.id} onClick={() => setSelected(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(item); }} tabIndex={0}>
          <div className="shop-card-image"><img src={item.imageUrl ?? ''} alt={item.name} /><span className="impossibility-tag">{impossibilityTag(item.category)}</span></div><div><p>{categoryLabel[item.category]}</p><h2>{item.name}</h2><span>◇ {item.price} Mirage</span><small>実物価格：存在しません</small></div>
        </article>
      ))}</div>
      <p className="fiction-note">このショップの商品はすべて架空です。現実のお金、商品の製造、配送は発生しません。</p>
      {selected && <ProductDialog item={selected} balance={user.balance} purchased={purchased.includes(selected.id)} onBuy={() => buy(selected)} onClose={() => setSelected(null)} />}
    </main>
  );
}

function ProductDialog({ item, balance, purchased, onBuy, onClose }: { item: Accessory; balance: number; purchased: boolean; onBuy: () => Promise<void>; onClose: () => void }) {
  const [buying, setBuying] = useState(false);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}><div className="product-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" aria-label="閉じる" onClick={onClose}><X /></button><img src={item.imageUrl ?? ''} alt={item.name} />
      <div className="modal-copy"><p className="category">{categoryLabel[item.category]}</p><span className="impossibility-tag inline">{impossibilityTag(item.category)}</span><h2>{item.name}</h2><p className="modal-short">{item.shortDescription}</p><blockquote>{item.lore}</blockquote><p className="impossible"><span>現実に作れない特徴</span>{item.impossibleFeature}</p><p className="nonphysical-note">この商品を物理世界へ配送することはできません。</p><div className="purchase-math"><span>価格 <b>◇ {item.price} Mirage</b><small>実物価格：存在しません</small></span><span>残高 {balance} → {Math.max(0, balance - item.price)}</span></div>
        {purchased ? <TryOnForm item={item} /> : <button className="button primary full" disabled={buying || balance < item.price} onClick={async () => { setBuying(true); await onBuy(); setBuying(false); }}>{buying ? <><CircleNotch className="spin" />迎える準備中…</> : balance < item.price ? 'Mirage残高が不足しています' : <>Mirageで迎える <Sparkle weight="fill" /></>}</button>}
      </div>
    </div></div>
  );
}

function TryOnForm({ item }: { item: Accessory }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const select = (file?: File) => {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file); setPreview(URL.createObjectURL(file)); setError('');
  };
  const submit = async () => {
    if (!photo) return;
    setLoading(true); setError('');
    const form = new FormData(); form.set('accessoryId', item.id); form.set('photo', photo);
    try {
      const result = await api<{ id: string }>('/api/try-ons', { method: 'POST', body: form });
      navigate(`/try-ons/${result.id}`);
    } catch (nextError) { setError(messageOf(nextError)); setLoading(false); }
  };
  return (
    <div className="tryon-box"><div className="purchased-badge"><Check weight="bold" /> コレクションに加わりました</div><h3>あなたの世界に呼び出す</h3><p>顔と装着部位が見える、1人だけの写真がおすすめです。元写真は成功後に削除します。</p>
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => select(event.target.files?.[0])} />
      <button className="photo-picker" onClick={() => inputRef.current?.click()}>{preview ? <img src={preview} alt="試着写真のプレビュー" /> : <><Plus />写真を選ぶ<small>JPEG / PNG / WebP · 10MB以下</small></>}</button>
      {error && <ErrorBox>{error}</ErrorBox>}
      {photo && <button className="button primary full" disabled={loading} onClick={submit}>{loading ? <><CircleNotch className="spin" />現実の物理法則を一部解除中…</> : <>{item.name}を呼び出す <Sparkle weight="fill" /></>}</button>}
    </div>
  );
}

function TryOnResultPage() {
  const { id } = useParams();
  const [result, setResult] = useState<{ accessoryName: string; shopName: string; resultUrl: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<{ accessoryName: string; shopName: string; resultUrl: string }>(`/api/try-ons/${id}`).then(setResult).catch((next) => setError(messageOf(next))); }, [id]);
  if (error) return <CenteredMessage title="試着結果を開けません" body={error} />;
  if (!result) return <CenteredMessage title="現実を書き換えています" body="アクセサリーの居場所を探しています…" busy />;
  return <main className="result-page page-width"><p className="eyebrow">MIRAGE MATERIALIZED</p><h1>存在しないものが、<br /><em>ここにある。</em></h1><div className="result-layout"><img src={result.resultUrl} alt={`${result.accessoryName}の試着結果`} /><div><p className="category">CALLED INTO YOUR WORLD</p><h2>{result.accessoryName}</h2><p>{result.shopName}</p><a className="button primary full" href={result.resultUrl} download>保存する <DownloadSimple /></a><Link className="text-link" to="/">空想市へ戻る <ArrowRight /></Link><p className="privacy-copy">元写真は生成成功後に削除されました。結果画像はこの匿名セッションからのみ閲覧できます。</p></div></div></main>;
}

function Progress({ current }: { current: number }) { return <div className="progress">{['世界観', '商品案', '商品画像', '公開'].map((label, index) => <span className={index + 1 <= current ? 'active' : ''} key={label}><i>{String(index + 1).padStart(2, '0')}</i>{label}</span>)}</div>; }
function Notice({ children }: { children: ReactNode }) { return <div className="notice"><Sparkle weight="fill" /> {children}</div>; }
function ErrorBox({ children }: { children: ReactNode }) { return <div className="error-box">{children}</div>; }
function CenteredMessage({ title, body, busy }: { title: string; body: string; busy?: boolean }) { return <main className="centered-message page-width">{busy && <CircleNotch className="loader" />}<h1>{title}</h1><p>{body}</p><Link className="text-link" to="/">トップへ戻る</Link></main>; }
function Footer() { return <footer><span><Sparkle weight="fill" /> MIRAGE MARKET</span><p>Wear What Cannot Exist.</p><small>Everything here is imaginary. © 2026</small></footer>; }
function statusLabel(status: Accessory['generationStatus']) { return { pending: '画像未生成', generating: '生成中…', completed: '完成', failed: '生成失敗' }[status]; }
function impossibilityTag(category: Category) { return { earrings: '重力から自由', necklace: '記憶に反応', headpiece: '影の中だけ存在' }[category]; }
function messageOf(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : '予期しないエラーが発生しました。'; }

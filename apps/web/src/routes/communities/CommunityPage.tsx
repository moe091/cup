import type { CommunitySummaryDto } from "@cup/shared-types";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCommunityBySlug } from "../../api/communities";


type Params = { slug: string };

export default function Community() {
  const { slug } = useParams<Params>();
  const [commSummary, setCommSummary] = useState<CommunitySummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      setErrorMessage("Missing community slug");
      return;
    }

    let active = true;

    setIsLoading(true);
    setErrorMessage(null);
    setCommSummary(null);
    const load = async () => {
      try {
        const data = await fetchCommunityBySlug(slug);
        if (!active) return;
        setCommSummary(data);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load community");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [slug]);

  function renderCommunitySummary() {
    if (commSummary) {
      const createdAtFormatted = new Date(commSummary.createdAt).toLocaleDateString();

      return (
        <div>
          <h1>{commSummary.name}</h1>
          <div>Owned by: {commSummary.ownerDisplayName || 'Unknown'}</div>
          <div>{commSummary.description || 'No description yet.'}</div>
          <div>Created at: {createdAtFormatted}</div>
          <div>Number of channels: {commSummary.channelCount}</div>
          <div>
            <Link to={`/communities/${commSummary.slug}/chat`}>Join Community Chat</Link>
          </div>
        </div>
      )
    } else {
      return null;
    }
  }

  if (isLoading) return <main></main>

  if (errorMessage) return <main>{errorMessage}</main>

  return (
    <main>
      {renderCommunitySummary()}
    </main>
  )
}

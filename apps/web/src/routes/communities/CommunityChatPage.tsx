import { useParams } from "react-router-dom";
import CommunityChatContainer from "../../features/chat/CommunityChatContainer";

type Params = { slug: string };

export default function CommunityChatPage() {
  const { slug } = useParams<Params>();
  return <CommunityChatContainer communitySlug={slug} />;
}

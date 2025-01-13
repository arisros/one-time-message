import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "./hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { BrowserRouter, Route, Routes, useParams, Link } from "react-router";
import superagent_ from "superagent";

const BASE_URL = import.meta.env.VITE_ENDPOINT_BASE_URL;

const superagent = superagent_.agent().use((request: superagent_.Request) => {
  request.url = `${BASE_URL}${request.url}`;
  return request;
});

async function getMessageService(id: string) {
  return superagent.get(`/message/${id}`);
}

async function createMessageService(message: string) {
  return superagent.post(`/message`).send({ message });
}

function CenteredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 w-v">
      {children}
    </div>
  );
}

function HomePage() {
  return (
    <CenteredLayout>
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to Secret Messages</h1>
        <img src="/logo.png" alt="logo" className="w-24 mx-auto" />
        <NoticeOneTimePad />
        <div className="space-x-4">
          <Link to="/create">
            <Button className="bg-blue-500 text-white py-2 px-4 rounded">
              Create Message
            </Button>
          </Link>
        </div>
      </div>
    </CenteredLayout>
  );
}

function NoticeOneTimePad() {
  return (
    <p className="mb-4">
      Securely share messages with one-time pad encryption. Messages are
      encrypted and can be viewed only once.
    </p>
  );
}
function MessageCreate() {
  const form = useForm();
  const [messageCreatedId, setMessageCreatedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function createMessage() {
    const message = form.getValues("message");
    setLoading(true);
    try {
      const response = await createMessageService(message);
      setMessageCreatedId(response.body.id);
      toast({
        title: "Message Created",
        description: `Your message ID: ${response.body.id}. You can share this with others.`,
      });
      form.reset();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "An error occurred while creating the message.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    const id = messageCreatedId;
    const url = `${window.location.origin}/message/${id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied to Clipboard",
      description: "Share the link with someone to view the message.",
    });
  }

  return (
    <CenteredLayout>
      <div>
        <h1 className="text-xl font-bold mb-4 text-center">Create a Message</h1>
        <NoticeOneTimePad />
        <form
          className="flex flex-col space-y-4"
          onSubmit={form.handleSubmit(createMessage)}
        >
          {!messageCreatedId && (
            <>
              <Input
                {...form.register("message", {
                  required: "Message is required",
                })}
                placeholder="Enter your secret message"
                className="p-2 border rounded min-w-[300px]"
              />
              <Button
                type="submit"
                className="bg-blue-500 text-white py-2 px-4 rounded"
                disabled={loading || !form.formState.isValid}
              >
                {loading ? "Creating..." : "Create"}
              </Button>
            </>
          )}
        </form>
        {messageCreatedId && (
          <div className="mt-4 text-center">
            <p className="text-green-600 mb-2">Message created successfully!</p>
            <Button
              type="button"
              variant={loading ? "ghost" : "default"}
              onClick={copyToClipboard}
            >
              Copy Link
            </Button>
          </div>
        )}
      </div>
    </CenteredLayout>
  );
}
function MessageContent() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const hasFetched = useRef(false); // This will track whether we've already fetched the message

  async function fetchMessage(id: string) {
    console.log("fetching message", id);
    try {
      const response = await getMessageService(id ?? "");
      const encryptedMessage = response.body.message;
      const key = response.body.key;
      const decryptedMessage = encryptedMessage
        .split("")
        .map((char: string, i: number) =>
          String.fromCharCode(
            char.charCodeAt(0) ^ key.charCodeAt(i % key.length)
          )
        )
        .join("");
      setMessage(decryptedMessage);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch the message. It might have expired.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.id && !hasFetched.current) {
      hasFetched.current = true; // Set this flag to true once the message has been fetched
      fetchMessage(params.id);
    }
  }, [params.id]); // Only depend on `params.id` to trigger the effect

  return (
    <CenteredLayout>
      <div>
        {loading && <div className="text-center">Loading...</div>}
        {error && <div className="text-center text-red-500">{error}</div>}
        {!loading && !error && (
          <div>
            <h1 className="text-xl font-bold mb-4 text-center">Your Message</h1>
            <div className="p-4 bg-gray-100 border rounded text-center">
              {message}
            </div>
            {/* button to create another */}
            <div className="mt-4 text-center">
              <Link to="/create">
                <Button className="bg-blue-500 text-white py-2 px-4 rounded">
                  Create Another Message
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </CenteredLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<MessageCreate />} />
        <Route path="/message/:id" element={<MessageContent />} />
      </Routes>
    </BrowserRouter>
  );
}

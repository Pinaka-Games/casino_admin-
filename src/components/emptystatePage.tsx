import {
  Search,
  FileQuestion,
  Inbox,
  AlertCircle,
  LucideIcon,
} from "lucide-react";
import Image, { StaticImageData } from "next/image";

interface EmptyStatePageProps {
  type?: "default" | "search" | "error" | "notFound";
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  image?: StaticImageData | string;

  /** ✅ NEW (OPTIONAL) */
  imageWidth?: number;
  imageHeight?: number;
}

const EmptyStatePage = ({
  type = "default",
  title,
  description,
  actionText,
  onAction,
  icon: CustomIcon,
  image,

  /** defaults */
  imageWidth = 320,
  imageHeight = 160,
}: EmptyStatePageProps) => {
  const emptyStates = {
    default: {
      icon: Inbox,
      title: "Nothing Here Yet",
      description: "Start adding items to see them appear here.",
    },
    search: {
      icon: Search,
      title: "No Results Found",
      description: "Try adjusting your search or filter criteria.",
    },
    error: {
      icon: AlertCircle,
      title: "Something Went Wrong",
      description: "We couldn't load the content. Please try again.",
    },
    notFound: {
      icon: FileQuestion,
      title: "Page Not Found",
      description: "The page you're looking for doesn't exist.",
    },
  };

  const state = emptyStates[type] || emptyStates.default;
  const IconComponent = CustomIcon || state.icon;

  return (
    <div className="flex items-center justify-center min-h-[30vh] my-6 rounded-lg">
      <div className="text-center px-6 py-2 max-w-md">

        {/* IMAGE / ICON */}
        <div className="flex justify-center mb-4">
          {image ? (
            <div className="relative">
              <div className="absolute inset-0 bg-[#B93DEB] opacity-20 blur-3xl rounded-full" />
              <Image
                src={image}
                alt="No data"
                width={imageWidth}
                height={imageHeight}
                className="object-contain relative z-10 opacity-90"
              />
            </div>
          ) : (
            <div className="relative">
              <div className="absolute inset-0 bg-[#B93DEB] opacity-25 blur-2xl rounded-full" />
              <IconComponent
                size={84}
                className="text-[#B93DEB] relative z-10"
                strokeWidth={1.5}
              />
            </div>
          )}
        </div>

        {/* TITLE */}
        <h1 className="text-base md:text-xl font-bold text-white mb-2">
          {title || state.title}
        </h1>

        {/* DESCRIPTION */}
        <p className="text-gray-400 text-sm md:text-lg mb-6">
          {description || state.description}
        </p>

        {/* ACTION BUTTON */}
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="
              px-7 py-3
              rounded-xl
              font-semibold
              text-white
              bg-[#cf4cff]
              hover:shadow-[0_0_35px_rgba(185,61,235,0.45)]
              active:scale-95
              transition-all duration-200
              focus:outline-none
              focus:ring-2 focus:ring-[#B93DEB]/60
            "
          >
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyStatePage;

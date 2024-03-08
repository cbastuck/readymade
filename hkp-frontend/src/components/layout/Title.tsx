import Image from "./Image";

type Props = {
  title: string;
  image?: string;
  caption: string;
};

export default function Title({ title, image, caption }: Props) {
  return (
    <>
      <div style={{ textAlign: "center" }}>
        <h1>{title}</h1>
      </div>

      <Image src={image} alt={caption} caption={caption} border={false} />
    </>
  );
}
